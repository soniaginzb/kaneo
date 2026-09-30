import { and, asc, eq } from "drizzle-orm";
import db from "../database";
import {
  columnTable,
  projectTable,
  taskRecurrenceTable,
  taskRelationTable,
  taskTable,
} from "../database/schema";
import duplicateTask from "../task/controllers/duplicate-task";
import { taskIsCompleted } from "../task/task-is-completed";
import { assertAssignableUser } from "../utils/assert-assignable-user";
import { nextDueDate } from "./next-occurrence";
import { parseRule } from "./rule";

class RuleAlreadyMoved extends Error {}

async function firstColumnSlug(projectId: string) {
  const [column] = await db
    .select({ slug: columnTable.slug })
    .from(columnTable)
    .where(eq(columnTable.projectId, projectId))
    .orderBy(asc(columnTable.position))
    .limit(1);
  if (!column) throw new Error(`Project ${projectId} has no columns`);
  return column.slug;
}

async function assignableOrNull(userId: string | null, workspaceId: string) {
  if (!userId) return null;
  try {
    await assertAssignableUser(userId, workspaceId);
    return userId;
  } catch {
    return null;
  }
}

function shifted(date: Date | null, shiftMs: number | null) {
  return date && shiftMs !== null ? new Date(date.getTime() + shiftMs) : null;
}

export async function spawnNextOccurrence({
  taskId,
  userId,
  now = new Date(),
}: {
  taskId: string;
  userId?: string;
  now?: Date;
}) {
  const [source] = await db
    .select({
      task: taskTable,
      workspaceId: projectTable.workspaceId,
      isCompleted: taskIsCompleted,
      recurrenceId: taskRecurrenceTable.id,
      rrule: taskRecurrenceTable.rrule,
      timeZone: taskRecurrenceTable.timeZone,
    })
    .from(taskTable)
    .innerJoin(
      taskRecurrenceTable,
      eq(taskRecurrenceTable.taskId, taskTable.id),
    )
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(eq(taskTable.id, taskId))
    .limit(1);
  if (!source?.isCompleted) return null;

  const previous = source.task;
  const dueDate = nextDueDate({
    rule: parseRule(source.rrule),
    timeZone: source.timeZone,
    previousDue: previous.dueDate,
    completedAt: now,
    now,
  });
  const startDate =
    previous.startDate && previous.dueDate
      ? new Date(
          dueDate.getTime() -
            (previous.dueDate.getTime() - previous.startDate.getTime()),
        )
      : null;
  // Integration webhooks can complete tasks without a signed-in user.
  const actorId = userId ?? previous.userId ?? "";

  let copy: Awaited<ReturnType<typeof duplicateTask>>;
  try {
    copy = await duplicateTask({
      taskId,
      currentUserId: actorId,
      canUpdateTasks: true,
      overrides: {
        status: await firstColumnSlug(previous.projectId),
        dueDate,
        startDate,
        userId: await assignableOrNull(previous.userId, source.workspaceId),
        // Moving the rule in the copy's transaction makes a repeat completion
        // (or a concurrent event) find nothing to move and roll back its copy.
        inTransaction: async (tx, task) => {
          const moved = await tx
            .update(taskRecurrenceTable)
            .set({ taskId: task.id })
            .where(
              and(
                eq(taskRecurrenceTable.id, source.recurrenceId),
                eq(taskRecurrenceTable.taskId, taskId),
              ),
            )
            .returning({ id: taskRecurrenceTable.id });
          if (moved.length === 0) throw new RuleAlreadyMoved();
        },
      },
    });
  } catch (error) {
    if (error instanceof RuleAlreadyMoved) return null;
    throw error;
  }

  const shiftMs = previous.dueDate
    ? dueDate.getTime() - previous.dueDate.getTime()
    : null;
  const subtasks = await db
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      userId: taskTable.userId,
      startDate: taskTable.startDate,
      dueDate: taskTable.dueDate,
    })
    .from(taskRelationTable)
    .innerJoin(taskTable, eq(taskRelationTable.targetTaskId, taskTable.id))
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        eq(taskRelationTable.sourceTaskId, taskId),
        eq(taskRelationTable.relationType, "subtask"),
        eq(projectTable.workspaceId, source.workspaceId),
      ),
    )
    .orderBy(asc(taskTable.number));

  // Subtasks are copied after the parent commits; one failing does not undo the rest.
  for (const subtask of subtasks) {
    try {
      await duplicateTask({
        taskId: subtask.id,
        currentUserId: actorId,
        canUpdateTasks: true,
        overrides: {
          status: await firstColumnSlug(subtask.projectId),
          dueDate: shifted(subtask.dueDate, shiftMs),
          startDate: shifted(subtask.startDate, shiftMs),
          userId: await assignableOrNull(subtask.userId, source.workspaceId),
          parents: [{ taskId: copy.id, projectId: copy.projectId }],
        },
      });
    } catch (error) {
      console.error(
        `Failed to copy subtask ${subtask.id} of recurring task ${taskId}:`,
        error,
      );
    }
  }

  return { taskId: copy.id };
}
