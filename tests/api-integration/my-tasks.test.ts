import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import getMyTasks, {
  type CompletedWindow,
} from "../../apps/api/src/my-tasks/controllers/get-my-tasks";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const NOW = new Date("2099-03-31T12:00:00.000Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

let taskNumber = 0;

async function addTask(
  values: Omit<typeof schema.taskTable.$inferInsert, "number">,
) {
  taskNumber += 1;
  const [task] = await db
    .insert(schema.taskTable)
    .values({ number: taskNumber, ...values })
    .returning();
  if (!task) throw new Error("seed failed");
  return task;
}

async function addMember(workspaceId: string, name: string) {
  const id = `user-${randomUUID()}`;
  const [user] = await db
    .insert(schema.userTable)
    .values({ id, email: `${id}@example.com`, emailVerified: true, name })
    .returning();
  if (!user) throw new Error("seed failed");
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: user.id,
    role: "member",
    joinedAt: new Date(),
  });
  return user;
}

async function seed() {
  const member = await createWorkspaceMember();
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
    name: "Content",
  });
  return {
    member,
    project,
    workspaceId: member.workspace.id,
    userId: member.user.id,
  };
}

const titles = (result: { tasks: Array<{ title: string }> }) =>
  result.tasks.map((task) => task.title).sort();

describe("API integration: my tasks query", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    taskNumber = 0;
  });

  it("returns my tasks and unassigned tasks, not other people's", async () => {
    const { member, project, workspaceId, userId } = await seed();
    const other = await addMember(workspaceId, "Other Writer");
    await addTask({
      projectId: project.id,
      title: "Mine",
      status: "to-do",
      userId,
      dueDate: new Date("2099-04-01T00:00:00.000Z"),
    });
    await addTask({
      projectId: project.id,
      title: "Nobody's",
      status: "to-do",
    });
    await addTask({
      projectId: project.id,
      title: "Theirs",
      status: "to-do",
      userId: other.id,
    });

    const result = await getMyTasks({
      workspaceId,
      userId,
      completed: "hide",
      now: NOW,
    });

    expect(titles(result)).toEqual(["Mine", "Nobody's"]);
    expect(result.truncated).toBe(false);
    expect(result.tasks.find((task) => task.title === "Mine")).toMatchObject({
      projectId: project.id,
      status: "to-do",
      priority: "low",
      dueDate: "2099-04-01T00:00:00.000Z",
      assignee: { id: userId, name: member.user.name, image: null },
      labels: [],
      parent: null,
      isRecurring: false,
      completed: false,
      completedAt: null,
    });
    expect(
      result.tasks.find((task) => task.title === "Nobody's")?.assignee,
    ).toBeNull();
  });

  it("leaves out archived projects, archived tasks and other workspaces", async () => {
    const { project, workspaceId, userId } = await seed();
    const { project: archived } = await createProjectFixture({
      workspaceId,
      name: "Old client",
    });
    await db
      .update(schema.projectTable)
      .set({ archivedAt: NOW })
      .where(eq(schema.projectTable.id, archived.id));
    const elsewhere = await createWorkspaceMember();
    const { project: foreign } = await createProjectFixture({
      workspaceId: elsewhere.workspace.id,
    });
    await addTask({ projectId: project.id, title: "Visible", status: "to-do" });
    await addTask({
      projectId: project.id,
      title: "Shelved",
      status: "archived",
    });
    await addTask({
      projectId: project.id,
      title: "Backlog idea",
      status: "planned",
    });
    await addTask({ projectId: archived.id, title: "Old", status: "to-do" });
    await addTask({ projectId: foreign.id, title: "Foreign", status: "to-do" });

    const result = await getMyTasks({
      workspaceId,
      userId,
      completed: "all",
      now: NOW,
    });

    expect(titles(result)).toEqual(["Backlog idea", "Visible"]);
    expect(result.projects.map((p) => p.id)).toEqual([project.id]);
  });

  it("lists active projects in sidebar order with their columns", async () => {
    const { project, workspaceId, userId } = await seed();
    const { project: second } = await createProjectFixture({
      workspaceId,
      name: "Client A",
    });
    await db
      .update(schema.projectTable)
      .set({ position: 2 })
      .where(eq(schema.projectTable.id, project.id));
    await db
      .update(schema.projectTable)
      .set({ position: 1 })
      .where(eq(schema.projectTable.id, second.id));

    const result = await getMyTasks({
      workspaceId,
      userId,
      completed: "hide",
      now: NOW,
    });

    expect(result.projects.map((p) => p.name)).toEqual(["Client A", "Content"]);
    expect(result.projects[1]).toMatchObject({
      id: project.id,
      slug: project.slug,
      icon: "Folder",
      position: 2,
    });
    expect(
      result.projects[1]?.columns.map((column) => [
        column.slug,
        column.isFinal,
      ]),
    ).toEqual([
      ["to-do", false],
      ["in-progress", false],
      ["in-review", false],
      ["done", true],
    ]);
  });

  it("filters completed tasks by when their status last changed", async () => {
    const { project, workspaceId, userId } = await seed();
    await addTask({ projectId: project.id, title: "Open", status: "to-do" });
    const recent = await addTask({
      projectId: project.id,
      title: "Done 3 days ago",
      status: "done",
    });
    const older = await addTask({
      projectId: project.id,
      title: "Done 10 days ago",
      status: "done",
    });
    await addTask({
      projectId: project.id,
      title: "Done long ago",
      status: "done",
      updatedAt: daysAgo(40),
    });
    await db.insert(schema.activityTable).values([
      {
        taskId: recent.id,
        type: "status_changed",
        userId,
        createdAt: daysAgo(40),
      },
      {
        taskId: recent.id,
        type: "status_changed",
        userId,
        createdAt: daysAgo(3),
      },
      { taskId: recent.id, type: "comment", userId, createdAt: daysAgo(1) },
      {
        taskId: older.id,
        type: "status_changed",
        userId,
        createdAt: daysAgo(10),
      },
    ]);
    const run = (completed: CompletedWindow) =>
      getMyTasks({ workspaceId, userId, completed, now: NOW });

    expect(titles(await run("hide"))).toEqual(["Open"]);

    const week = await run("7d");
    expect(titles(week)).toEqual(["Done 3 days ago", "Open"]);
    expect(week.tasks.find((task) => task.id === recent.id)).toMatchObject({
      completed: true,
      completedAt: daysAgo(3).toISOString(),
    });

    expect(titles(await run("30d"))).toEqual([
      "Done 10 days ago",
      "Done 3 days ago",
      "Open",
    ]);

    const all = await run("all");
    expect(titles(all)).toEqual([
      "Done 10 days ago",
      "Done 3 days ago",
      "Done long ago",
      "Open",
    ]);
    expect(
      all.tasks.find((task) => task.title === "Done long ago")?.completedAt,
    ).toBe(daysAgo(40).toISOString());
  });

  it("adds parents, labels and repeat flags", async () => {
    const { project, workspaceId, userId } = await seed();
    const parent = await addTask({
      projectId: project.id,
      title: "Newsletter",
      status: "to-do",
    });
    const child = await addTask({
      projectId: project.id,
      title: "Draft intro",
      status: "to-do",
    });
    await db.insert(schema.taskRelationTable).values({
      sourceTaskId: parent.id,
      targetTaskId: child.id,
      relationType: "subtask",
    });
    const [label] = await db
      .insert(schema.labelTable)
      .values({
        name: "Client",
        color: "#ff0000",
        taskId: child.id,
        workspaceId,
      })
      .returning();
    await db.insert(schema.taskRecurrenceTable).values({
      taskId: parent.id,
      rrule: "FREQ=DAILY;INTERVAL=1",
      timeZone: "UTC",
    });

    const result = await getMyTasks({
      workspaceId,
      userId,
      completed: "hide",
      now: NOW,
    });
    const byTitle = new Map(result.tasks.map((task) => [task.title, task]));

    expect(byTitle.get("Draft intro")).toMatchObject({
      parent: { id: parent.id, title: "Newsletter" },
      labels: [{ id: label?.id, name: "Client", color: "#ff0000" }],
      isRecurring: false,
    });
    expect(byTitle.get("Newsletter")).toMatchObject({
      parent: null,
      labels: [],
      isRecurring: true,
    });
  });

  it("orders by due date with undated tasks last and flags truncation", async () => {
    const { project, workspaceId, userId } = await seed();
    await addTask({ projectId: project.id, title: "Undated", status: "to-do" });
    await addTask({
      projectId: project.id,
      title: "Second",
      status: "to-do",
      dueDate: new Date("2099-04-02T00:00:00.000Z"),
    });
    await addTask({
      projectId: project.id,
      title: "First",
      status: "to-do",
      dueDate: new Date("2099-04-01T00:00:00.000Z"),
    });

    const cut = await getMyTasks({
      workspaceId,
      userId,
      completed: "hide",
      now: NOW,
      limit: 2,
    });
    expect(cut.tasks.map((task) => task.title)).toEqual(["First", "Second"]);
    expect(cut.truncated).toBe(true);

    const full = await getMyTasks({
      workspaceId,
      userId,
      completed: "hide",
      now: NOW,
      limit: 3,
    });
    expect(full.tasks.map((task) => task.title)).toEqual([
      "First",
      "Second",
      "Undated",
    ]);
    expect(full.truncated).toBe(false);
  });

  it("returns nothing for a workspace without active projects", async () => {
    const member = await createWorkspaceMember();
    expect(
      await getMyTasks({
        workspaceId: member.workspace.id,
        userId: member.user.id,
        completed: "all",
        now: NOW,
      }),
    ).toEqual({ tasks: [], projects: [], truncated: false });
  });
});
