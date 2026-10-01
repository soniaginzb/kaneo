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

async function seed() {
  const member = await createWorkspaceMember();
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  await db.insert(schema.taskTable).values([
    { projectId: project.id, title: "Open", status: "to-do", number: 1 },
    { projectId: project.id, title: "Finished", status: "done", number: 2 },
  ]);
  return member;
}

describe("API integration: my tasks route", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects anonymous requests", async () => {
    const member = await seed();
    mockAnonymousSession();
    const response = await createApp().app.request(
      `/api/my-tasks/${member.workspace.id}`,
    );
    expect(response.status).toBe(401);
  });

  it("returns the member's tasks, hiding completed ones by default", async () => {
    const member = await seed();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const open = await app.request(`/api/my-tasks/${member.workspace.id}`);
    expect(open.status).toBe(200);
    const body = await open.json();
    expect(body.tasks.map((task: { title: string }) => task.title)).toEqual([
      "Open",
    ]);
    expect(body.projects).toHaveLength(1);
    expect(body.truncated).toBe(false);

    const all = await app.request(
      `/api/my-tasks/${member.workspace.id}?completed=all`,
    );
    expect((await all.json()).tasks).toHaveLength(2);
  });

  it("refuses people outside the workspace", async () => {
    const member = await seed();
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

    const response = await createApp().app.request(
      `/api/my-tasks/${member.workspace.id}`,
    );
    expect(response.status).toBe(403);
  });

  it("rejects unknown completed windows", async () => {
    const member = await seed();
    mockAuthenticatedSession(member.user);
    const response = await createApp().app.request(
      `/api/my-tasks/${member.workspace.id}?completed=week`,
    );
    expect(response.status).toBe(400);
  });
});
