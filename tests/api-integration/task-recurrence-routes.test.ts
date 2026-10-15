import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

async function seed(role = "member") {
  const member = await createWorkspaceMember({ role });
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
      dueDate: new Date("2099-01-05T00:00:00Z"),
    })
    .returning();
  if (!task) throw new Error("seed failed");
  return { member, project, task };
}

function put(
  app: ReturnType<typeof createApp>["app"],
  taskId: string,
  body: unknown,
) {
  return app.request(`/api/task-recurrence/${taskId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("API integration: task recurrence routes", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects anonymous requests", async () => {
    const { task } = await seed();
    mockAnonymousSession();
    const { app } = createApp();
    expect((await app.request(`/api/task-recurrence/${task.id}`)).status).toBe(
      401,
    );
  });

  it("lets a member set, read, list and stop a rule", async () => {
    const { member, project, task } = await seed();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const saved = await put(app, task.id, {
      rrule: "FREQ=WEEKLY;BYDAY=TH,MO",
      timeZone: "UTC",
    });
    expect(saved.status).toBe(200);
    // 5 Jan 2099 is a Monday, so the next occurrence is Thursday 8 Jan.
    expect(await saved.json()).toEqual({
      taskId: task.id,
      rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TH",
      timeZone: "UTC",
      nextDueDate: "2099-01-08T00:00:00.000Z",
    });

    const read = await app.request(`/api/task-recurrence/${task.id}`);
    expect((await read.json()).recurrence).toMatchObject({
      rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TH",
    });

    const listed = await app.request(
      `/api/task-recurrence/project/${project.id}`,
    );
    expect(await listed.json()).toEqual({ taskIds: [task.id] });

    const replaced = await put(app, task.id, {
      rrule: "FREQ=DAILY",
      timeZone: "Europe/London",
    });
    expect((await replaced.json()).rrule).toBe("FREQ=DAILY;INTERVAL=1");
    expect(await db.select().from(schema.taskRecurrenceTable)).toHaveLength(1);

    const stopped = await app.request(`/api/task-recurrence/${task.id}`, {
      method: "DELETE",
    });
    expect(await stopped.json()).toEqual({ deleted: true });
    expect(
      (await (await app.request(`/api/task-recurrence/${task.id}`)).json())
        .recurrence,
    ).toBeNull();
  });

  it("rejects unsupported rules and unknown time zones", async () => {
    const { member, task } = await seed();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    expect(
      (await put(app, task.id, { rrule: "FREQ=HOURLY", timeZone: "UTC" }))
        .status,
    ).toBe(400);
    expect(
      (
        await put(app, task.id, {
          rrule: "FREQ=DAILY",
          timeZone: "Mars/Olympus_Mons",
        })
      ).status,
    ).toBe(400);
  });

  it("blocks viewers and hides tasks from outsiders", async () => {
    const viewer = await seed("viewer");
    mockAuthenticatedSession(viewer.member.user);
    expect(
      (
        await put(createApp().app, viewer.task.id, {
          rrule: "FREQ=DAILY",
          timeZone: "UTC",
        })
      ).status,
    ).toBe(403);

    const outsiderId = `user-${randomUUID()}`;
    const [outsider] = await db
      .insert(schema.userTable)
      .values({
        id: outsiderId,
        email: `${outsiderId}@example.com`,
        emailVerified: true,
        name: "Outsider",
      })
      .returning();
    if (!outsider) throw new Error("seed failed");
    mockAuthenticatedSession(outsider);
    expect(
      (
        await put(createApp().app, viewer.task.id, {
          rrule: "FREQ=DAILY",
          timeZone: "UTC",
        })
      ).status,
    ).toBe(404);
  });
});
