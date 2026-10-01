import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { makeProject, makeTask } from "@/lib/my-tasks/test-fixtures";
import type { MyTasksData } from "@/lib/my-tasks/types";
import useUpdateMyTask from "./use-update-my-task";

const mocks = vi.hoisted(() => ({
  updateTaskStatus: vi.fn(),
  updatePriority: vi.fn(),
}));
vi.mock("@/fetchers/task/update-task-status", () => ({
  default: mocks.updateTaskStatus,
}));
vi.mock("@/fetchers/my-tasks/update-my-task-priority", () => ({
  default: mocks.updatePriority,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const KEY = ["my-tasks", "ws-1", "hide"];
const DATA: MyTasksData = {
  tasks: [makeTask({ id: "t1" })],
  projects: [makeProject()],
  truncated: false,
};

function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  client.setQueryData(KEY, DATA);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useUpdateMyTask("ws-1"), { wrapper });
  return { client, result };
}

describe("useUpdateMyTask", () => {
  it("shows the change at once and keeps it when the save succeeds", async () => {
    mocks.updateTaskStatus.mockResolvedValue({});
    const { client, result } = setup();

    act(() => {
      result.current.mutate({ taskId: "t1", projectId: "p1", status: "done" });
    });

    await waitFor(() =>
      expect(client.getQueryData<MyTasksData>(KEY)?.tasks[0]?.completed).toBe(
        true,
      ),
    );
    expect(mocks.updateTaskStatus).toHaveBeenCalledWith("t1", {
      status: "done",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("rolls the change back when the save fails", async () => {
    let reject: (error: Error) => void = () => {};
    mocks.updatePriority.mockReturnValue(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    const { client, result } = setup();

    act(() => {
      result.current.mutate({
        taskId: "t1",
        projectId: "p1",
        priority: "urgent",
      });
    });
    await waitFor(() =>
      expect(client.getQueryData<MyTasksData>(KEY)?.tasks[0]?.priority).toBe(
        "urgent",
      ),
    );

    await act(async () => {
      reject(new Error("boom"));
    });

    await waitFor(() =>
      expect(client.getQueryData<MyTasksData>(KEY)?.tasks[0]).toEqual(
        DATA.tasks[0],
      ),
    );
    expect(mocks.updatePriority).toHaveBeenCalledWith("t1", "urgent");
  });
});
