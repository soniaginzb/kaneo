import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import db from "../../database";
import {
  activityTable,
  columnTable,
  labelTable,
  projectTable,
  taskRecurrenceTable,
  taskRelationTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { taskIsCompleted } from "../../task/task-is-completed";

export const MY_TASKS_LIMIT = 2000;
export const COMPLETED_WINDOWS = ["hide", "7d", "30d", "all"] as const;
export type CompletedWindow = (typeof COMPLETED_WINDOWS)[number];

const WINDOW_DAYS: Record<"7d" | "30d", number> = { "7d": 7, "30d": 30 };
const DAY_MS = 86_400_000;

// When a completed task was completed: its latest status change, or its last
// edit when no status change was recorded (e.g. it was created in Done).
const completedAt =
  sql<Date | null>`case when ${taskIsCompleted} then coalesce((
  select max(${activityTable.createdAt}) from ${activityTable}
  where ${activityTable.taskId} = ${taskTable.id}
    and ${activityTable.type} = 'status_changed'
), ${taskTable.updatedAt}) end`.mapWith(taskTable.updatedAt);

function completedCondition(
  completed: CompletedWindow,
  now: Date,
): SQL | undefined {
  if (completed === "all") return undefined;
  if (completed === "hide") return sql`not ${taskIsCompleted}`;
  const since = new Date(now.getTime() - WINDOW_DAYS[completed] * DAY_MS);
  // Timestamps are stored as UTC wall time without a zone, like Drizzle writes them.
  return sql`(not ${taskIsCompleted} or ${completedAt} >= ${since.toISOString()}::timestamp)`;
}

const toIso = (value: Date | null) => (value ? value.toISOString() : null);

type GetMyTasksInput = {
  workspaceId: string;
  userId: string;
  completed: CompletedWindow;
  now?: Date;
  limit?: number;
};

async function getMyTasks({
  workspaceId,
  userId,
  completed,
  now = new Date(),
  limit = MY_TASKS_LIMIT,
}: GetMyTasksInput) {
  const projects = await db
    .select({
      id: projectTable.id,
      name: projectTable.name,
      slug: projectTable.slug,
      icon: projectTable.icon,
      position: projectTable.position,
    })
    .from(projectTable)
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        isNull(projectTable.archivedAt),
      ),
    )
    .orderBy(asc(projectTable.position), asc(projectTable.createdAt));

  if (projects.length === 0) {
    return { tasks: [], projects: [], truncated: false };
  }

  const projectIds = projects.map((project) => project.id);

  const columns = await db
    .select({
      id: columnTable.id,
      name: columnTable.name,
      slug: columnTable.slug,
      position: columnTable.position,
      isFinal: columnTable.isFinal,
      projectId: columnTable.projectId,
    })
    .from(columnTable)
    .where(inArray(columnTable.projectId, projectIds))
    .orderBy(asc(columnTable.position), asc(columnTable.createdAt));

  const rows = await db
    .select({
      id: taskTable.id,
      number: taskTable.number,
      title: taskTable.title,
      status: taskTable.status,
      priority: taskTable.priority,
      startDate: taskTable.startDate,
      dueDate: taskTable.dueDate,
      createdAt: taskTable.createdAt,
      projectId: taskTable.projectId,
      assigneeId: userTable.id,
      assigneeName: userTable.name,
      assigneeImage: userTable.image,
      completed: sql<boolean>`${taskIsCompleted}`.mapWith(Boolean),
      completedAt,
      isRecurring: sql<boolean>`exists (
        select 1 from ${taskRecurrenceTable}
        where ${taskRecurrenceTable.taskId} = ${taskTable.id}
      )`.mapWith(Boolean),
    })
    .from(taskTable)
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .where(
      and(
        inArray(taskTable.projectId, projectIds),
        or(eq(taskTable.userId, userId), isNull(taskTable.userId)),
        ne(taskTable.status, "archived"),
        completedCondition(completed, now),
      ),
    )
    .orderBy(
      sql`${taskTable.dueDate} asc nulls last`,
      asc(taskTable.createdAt),
      asc(taskTable.id),
    )
    .limit(limit + 1);

  const truncated = rows.length > limit;
  const taskRows = truncated ? rows.slice(0, limit) : rows;
  const taskIds = taskRows.map((row) => row.id);

  const labels =
    taskIds.length > 0
      ? await db
          .select({
            id: labelTable.id,
            name: labelTable.name,
            color: labelTable.color,
            taskId: labelTable.taskId,
          })
          .from(labelTable)
          .where(inArray(labelTable.taskId, taskIds))
          .orderBy(asc(labelTable.name))
      : [];

  const parents =
    taskIds.length > 0
      ? await db
          .select({
            childId: taskRelationTable.targetTaskId,
            id: taskTable.id,
            title: taskTable.title,
          })
          .from(taskRelationTable)
          .innerJoin(
            taskTable,
            eq(taskRelationTable.sourceTaskId, taskTable.id),
          )
          .where(
            and(
              inArray(taskRelationTable.targetTaskId, taskIds),
              eq(taskRelationTable.relationType, "subtask"),
            ),
          )
      : [];

  const labelsByTask = new Map<
    string,
    Array<{ id: string; name: string; color: string }>
  >();
  for (const label of labels) {
    if (!label.taskId) continue;
    const list = labelsByTask.get(label.taskId) ?? [];
    list.push({ id: label.id, name: label.name, color: label.color });
    labelsByTask.set(label.taskId, list);
  }

  const parentByTask = new Map(
    parents.map((parent) => [
      parent.childId,
      { id: parent.id, title: parent.title },
    ]),
  );

  const columnsByProject = new Map<
    string,
    Array<{
      id: string;
      name: string;
      slug: string;
      position: number;
      isFinal: boolean;
    }>
  >();
  for (const { projectId, ...column } of columns) {
    const list = columnsByProject.get(projectId) ?? [];
    list.push(column);
    columnsByProject.set(projectId, list);
  }

  return {
    tasks: taskRows.map((row) => ({
      id: row.id,
      number: row.number,
      title: row.title,
      status: row.status,
      priority: row.priority,
      startDate: toIso(row.startDate),
      dueDate: toIso(row.dueDate),
      createdAt: row.createdAt.toISOString(),
      projectId: row.projectId,
      assignee: row.assigneeId
        ? {
            id: row.assigneeId,
            name: row.assigneeName ?? "",
            image: row.assigneeImage ?? null,
          }
        : null,
      labels: labelsByTask.get(row.id) ?? [],
      parent: parentByTask.get(row.id) ?? null,
      isRecurring: row.isRecurring,
      completed: row.completed,
      completedAt: toIso(row.completedAt),
    })),
    projects: projects.map((project) => ({
      ...project,
      columns: columnsByProject.get(project.id) ?? [],
    })),
    truncated,
  };
}

export default getMyTasks;
