import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import duplicateTask from "../../apps/api/src/task/controllers/duplicate-task";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

async function seed() {
  const member = await createWorkspaceMember();
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [parent, source] = await db
    .insert(schema.taskTable)
    .values([
      {
        projectId: project.id,
        columnId: columns.todo.id,
        title: "Parent",
        status: "to-do",
        number: 1,
      },
      {
        projectId: project.id,
        columnId: columns.done.id,
        title: "Weekly batch",
        status: "done",
        number: 2,
        userId: member.user.id,
        dueDate: new Date("2026-10-05T00:00:00Z"),
        startDate: new Date("2026-10-04T00:00:00Z"),
      },
    ])
    .returning();
  if (!parent || !source) throw new Error("seed failed");
  await db
    .update(schema.projectTable)
    .set({ lastTaskNumber: 2 })
    .where(eq(schema.projectTable.id, project.id));
  return { member, project, parent, source };
}

describe("API integration: duplicateTask overrides", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("applies status, dates, assignee and replacement parents", async () => {
    const { member, project, parent, source } = await seed();

    const copy = await duplicateTask({
      taskId: source.id,
      currentUserId: member.user.id,
      canUpdateTasks: true,
      overrides: {
        status: "to-do",
        dueDate: new Date("2026-10-12T00:00:00Z"),
        startDate: null,
        userId: null,
        parents: [{ taskId: parent.id, projectId: project.id }],
      },
    });

    expect(copy.status).toBe("to-do");
    expect(copy.dueDate?.toISOString()).toBe("2026-10-12T00:00:00.000Z");
    expect(copy.startDate).toBeNull();
    expect(copy.userId).toBeNull();
    expect(copy.number).toBe(3);
    const relations = await db
      .select()
      .from(schema.taskRelationTable)
      .where(eq(schema.taskRelationTable.targetTaskId, copy.id));
    expect(relations).toEqual([
      expect.objectContaining({
        sourceTaskId: parent.id,
        relationType: "subtask",
      }),
    ]);
  });

  it("keeps source values when overrides are omitted", async () => {
    const { member, source } = await seed();

    const copy = await duplicateTask({
      taskId: source.id,
      currentUserId: member.user.id,
      canUpdateTasks: true,
    });

    expect(copy.status).toBe("done");
    expect(copy.userId).toBe(member.user.id);
    expect(copy.dueDate?.toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });

  it("rolls the copy back when inTransaction throws", async () => {
    const { member, project, source } = await seed();

    await expect(
      duplicateTask({
        taskId: source.id,
        currentUserId: member.user.id,
        canUpdateTasks: true,
        overrides: {
          inTransaction: async () => {
            throw new Error("abort");
          },
        },
      }),
    ).rejects.toThrow("abort");

    const tasks = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.projectId, project.id));
    expect(tasks).toHaveLength(2);
  });
});
