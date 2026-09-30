import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { spawnNextOccurrence } from "../../apps/api/src/task-recurrence/spawn-next-occurrence";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const NOW = new Date("2026-10-05T12:00:00Z");

async function seedRecurring({ completed = true } = {}) {
  const member = await createWorkspaceMember();
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const column = completed ? columns.done : columns.todo;
  const [task, subtask] = await db
    .insert(schema.taskTable)
    .values([
      {
        projectId: project.id,
        columnId: column.id,
        status: column.slug,
        title: "Write one Typeshare post",
        description: "Draft, edit, publish",
        priority: "high",
        number: 1,
        userId: member.user.id,
        dueDate: new Date("2026-10-05T00:00:00Z"),
      },
      {
        projectId: project.id,
        columnId: columns.done.id,
        status: "done",
        title: "Pick a topic",
        number: 2,
        dueDate: new Date("2026-10-04T00:00:00Z"),
      },
    ])
    .returning();
  if (!task || !subtask) throw new Error("seed failed");
  await db
    .update(schema.projectTable)
    .set({ lastTaskNumber: 2 })
    .where(eq(schema.projectTable.id, project.id));
  await db.insert(schema.taskRelationTable).values({
    sourceTaskId: task.id,
    targetTaskId: subtask.id,
    relationType: "subtask",
  });
  await db.insert(schema.labelTable).values({
    name: "content",
    color: "blue",
    taskId: task.id,
    workspaceId: member.workspace.id,
  });
  await db.insert(schema.taskRecurrenceTable).values({
    taskId: task.id,
    rrule: "FREQ=DAILY;INTERVAL=1",
    timeZone: "UTC",
  });
  return { member, project, columns, task, subtask };
}

function tasksIn(projectId: string) {
  return db
    .select()
    .from(schema.taskTable)
    .where(eq(schema.taskTable.projectId, projectId));
}

describe("API integration: spawning recurring tasks", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("creates the next copy with fresh subtasks and moves the rule", async () => {
    const { member, project, task } = await seedRecurring();

    const result = await spawnNextOccurrence({
      taskId: task.id,
      userId: member.user.id,
      now: NOW,
    });

    expect(result).not.toBeNull();
    const copy = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, result?.taskId ?? ""),
    });
    expect(copy).toMatchObject({
      title: "Write one Typeshare post",
      description: "Draft, edit, publish",
      priority: "high",
      status: "to-do",
      number: 3,
      userId: member.user.id,
    });
    expect(copy?.dueDate?.toISOString()).toBe("2026-10-06T00:00:00.000Z");

    const labels = await db
      .select()
      .from(schema.labelTable)
      .where(eq(schema.labelTable.taskId, copy?.id ?? ""));
    expect(labels.map((label) => label.name)).toEqual(["content"]);

    const rules = await db.select().from(schema.taskRecurrenceTable);
    expect(rules).toEqual([expect.objectContaining({ taskId: copy?.id })]);

    const children = await db
      .select({ task: schema.taskTable })
      .from(schema.taskRelationTable)
      .innerJoin(
        schema.taskTable,
        eq(schema.taskRelationTable.targetTaskId, schema.taskTable.id),
      )
      .where(
        and(
          eq(schema.taskRelationTable.sourceTaskId, copy?.id ?? ""),
          eq(schema.taskRelationTable.relationType, "subtask"),
        ),
      );
    expect(children).toHaveLength(1);
    expect(children[0]?.task).toMatchObject({
      title: "Pick a topic",
      status: "to-do",
      number: 4,
    });
    expect(children[0]?.task.dueDate?.toISOString()).toBe(
      "2026-10-05T00:00:00.000Z",
    );

    expect(await tasksIn(project.id)).toHaveLength(4);
  });

  it("does nothing for a task that is not complete or has no rule", async () => {
    const open = await seedRecurring({ completed: false });
    expect(
      await spawnNextOccurrence({
        taskId: open.task.id,
        userId: open.member.user.id,
        now: NOW,
      }),
    ).toBeNull();

    const done = await seedRecurring();
    await db
      .delete(schema.taskRecurrenceTable)
      .where(eq(schema.taskRecurrenceTable.taskId, done.task.id));
    expect(
      await spawnNextOccurrence({
        taskId: done.task.id,
        userId: done.member.user.id,
        now: NOW,
      }),
    ).toBeNull();
  });

  it("never spawns twice from the same completed task", async () => {
    const { member, project, task } = await seedRecurring();

    await spawnNextOccurrence({
      taskId: task.id,
      userId: member.user.id,
      now: NOW,
    });
    const second = await spawnNextOccurrence({
      taskId: task.id,
      userId: member.user.id,
      now: NOW,
    });

    expect(second).toBeNull();
    expect(await tasksIn(project.id)).toHaveLength(4);
  });

  it("keeps the copy's rule when the old task is deleted", async () => {
    const { member, task } = await seedRecurring();
    const result = await spawnNextOccurrence({
      taskId: task.id,
      userId: member.user.id,
      now: NOW,
    });

    await db.delete(schema.taskTable).where(eq(schema.taskTable.id, task.id));

    const rules = await db.select().from(schema.taskRecurrenceTable);
    expect(rules).toEqual([
      expect.objectContaining({ taskId: result?.taskId }),
    ]);
  });

  it("creates an unassigned copy when the assignee left the workspace", async () => {
    const { member, task } = await seedRecurring();
    const leaver = await createWorkspaceMember();
    await db
      .update(schema.taskTable)
      .set({ userId: leaver.user.id })
      .where(eq(schema.taskTable.id, task.id));

    const result = await spawnNextOccurrence({
      taskId: task.id,
      userId: member.user.id,
      now: NOW,
    });

    const copy = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, result?.taskId ?? ""),
    });
    expect(copy?.userId).toBeNull();
  });

  it("spawns once when completed through the status route and again through bulk update, without repeats on re-completion", async () => {
    const { member, project, task } = await seedRecurring({ completed: false });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const json = { "content-type": "application/json" };

    await app.request(`/api/task/status/${task.id}`, {
      method: "PUT",
      headers: json,
      body: JSON.stringify({ status: "done" }),
    });
    await vi.waitFor(
      async () => expect(await tasksIn(project.id)).toHaveLength(4),
      { timeout: 10_000, interval: 100 },
    );

    // Out of Done and back in: the rule already moved, so nothing new appears.
    await app.request(`/api/task/status/${task.id}`, {
      method: "PUT",
      headers: json,
      body: JSON.stringify({ status: "to-do" }),
    });
    await app.request(`/api/task/status/${task.id}`, {
      method: "PUT",
      headers: json,
      body: JSON.stringify({ status: "done" }),
    });

    const [rule] = await db.select().from(schema.taskRecurrenceTable);
    await app.request("/api/task/bulk", {
      method: "PATCH",
      headers: json,
      body: JSON.stringify({
        taskIds: [rule?.taskId],
        operation: "updateStatus",
        value: "done",
      }),
    });
    await vi.waitFor(
      async () => expect(await tasksIn(project.id)).toHaveLength(6),
      { timeout: 10_000, interval: 100 },
    );
    // Give any stray duplicate handler time to run before asserting nothing else appeared.
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await tasksIn(project.id)).toHaveLength(6);
  }, 30_000);
});
