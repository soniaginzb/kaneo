import { describe, expect, it } from "vite-plus/test";
import { applyMyTaskChange } from "./apply-change";
import { makeProject, makeTask } from "./test-fixtures";
import type { MyTasksData } from "./types";

const NOW = new Date("2026-10-07T03:00:00.000Z");
const data: MyTasksData = {
  tasks: [makeTask({ id: "t1" }), makeTask({ id: "t2", title: "Other" })],
  projects: [makeProject()],
  truncated: false,
};

describe("applyMyTaskChange", () => {
  it("marks a task completed when it moves into a Done column", () => {
    const next = applyMyTaskChange(
      data,
      { taskId: "t1", projectId: "p1", status: "done" },
      NOW,
    );
    expect(next.tasks[0]).toMatchObject({
      status: "done",
      completed: true,
      completedAt: NOW.toISOString(),
    });
    expect(next.tasks[1]).toBe(data.tasks[1]);
    expect(data.tasks[0]?.status).toBe("to-do");
  });

  it("reopens a completed task", () => {
    const done: MyTasksData = {
      ...data,
      tasks: [
        makeTask({
          id: "t1",
          status: "done",
          completed: true,
          completedAt: "2026-10-01T00:00:00.000Z",
        }),
      ],
    };
    expect(
      applyMyTaskChange(
        done,
        { taskId: "t1", projectId: "p1", status: "to-do" },
        NOW,
      ).tasks[0],
    ).toMatchObject({ status: "to-do", completed: false, completedAt: null });
  });

  it("changes priority without touching completion", () => {
    expect(
      applyMyTaskChange(
        data,
        { taskId: "t1", projectId: "p1", priority: "urgent" },
        NOW,
      ).tasks[0],
    ).toMatchObject({ priority: "urgent", status: "to-do", completed: false });
  });
});
