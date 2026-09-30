import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

describe("API integration: task_recurrence table", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("stores one rule per task and deletes it with the task", async () => {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        columnId: columns.todo.id,
        title: "Typeshare post",
        status: "to-do",
        number: 1,
      })
      .returning();
    if (!task) throw new Error("seed failed");

    await db.insert(schema.taskRecurrenceTable).values({
      taskId: task.id,
      rrule: "FREQ=DAILY;INTERVAL=1",
      timeZone: "UTC",
    });
    await expect(
      db.insert(schema.taskRecurrenceTable).values({
        taskId: task.id,
        rrule: "FREQ=DAILY;INTERVAL=2",
        timeZone: "UTC",
      }),
    ).rejects.toThrow();

    await db.delete(schema.taskTable).where(eq(schema.taskTable.id, task.id));
    const remaining = await db.select().from(schema.taskRecurrenceTable);
    expect(remaining).toHaveLength(0);
  });
});
