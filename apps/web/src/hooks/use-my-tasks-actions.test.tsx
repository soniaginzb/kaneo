import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { makeProject, makeTask } from "@/lib/my-tasks/test-fixtures";
import type { GroupBy, MyTasksData } from "@/lib/my-tasks/types";
import { useMyTasksActions } from "./use-my-tasks-actions";

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), toastError: vi.fn() }));
vi.mock("@/hooks/mutations/my-tasks/use-update-my-task", () => ({
  default: () => ({ mutate: mocks.mutate }),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: mocks.toastError } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const data: MyTasksData = {
  tasks: [],
  projects: [
    makeProject({ id: "p1", name: "Client A" }),
    makeProject({
      id: "p2",
      columns: [
        { id: "x", name: "To Do", slug: "to-do", position: 0, isFinal: false },
      ],
    }),
  ],
  truncated: false,
};
const actions = (groupBy: GroupBy) =>
  renderHook(() => useMyTasksActions("ws-1", data, groupBy)).result.current;

describe("useMyTasksActions", () => {
  it("completes a task into its project's Done column", () => {
    actions("dueDate").toggleComplete(makeTask({ id: "t1", projectId: "p1" }));
    expect(mocks.mutate).toHaveBeenCalledWith(
      { taskId: "t1", projectId: "p1", status: "done" },
      { onError: expect.any(Function) },
    );
  });

  it("does nothing when the project has no Done column", () => {
    actions("dueDate").toggleComplete(makeTask({ projectId: "p2" }));
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("moves a dropped card to the matching column or priority", () => {
    actions("status").drop(
      makeTask({ id: "t1" }),
      "in-progress",
      "In Progress",
    );
    expect(mocks.mutate).toHaveBeenLastCalledWith(
      { taskId: "t1", projectId: "p1", status: "in-progress" },
      { onError: expect.any(Function) },
    );
    actions("priority").drop(makeTask({ id: "t1" }), "urgent", "Urgent");
    expect(mocks.mutate).toHaveBeenLastCalledWith(
      { taskId: "t1", projectId: "p1", priority: "urgent" },
      { onError: expect.any(Function) },
    );
  });

  it("refuses a drop on a column the project does not have", () => {
    actions("status").drop(
      makeTask({ projectId: "p1" }),
      "drafting",
      "Drafting",
    );
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(
      'tasks:myTasks.missingColumn {"project":"Client A","column":"Drafting"}',
    );
  });

  it("reports a failed save", () => {
    actions("dueDate").toggleComplete(makeTask({ projectId: "p1" }));
    const [, options] = mocks.mutate.mock.calls[0] ?? [];
    options.onError();
    expect(mocks.toastError).toHaveBeenCalledWith("tasks:myTasks.updateFailed");
  });
});
