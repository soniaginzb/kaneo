import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { DEFAULT_PREFERENCES } from "@/lib/my-tasks/types";
import { useMyTasksPreferences } from "./use-my-tasks-preferences";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("useMyTasksPreferences", () => {
  it("starts from defaults and saves changes for this workspace only", () => {
    const { result } = renderHook(() => useMyTasksPreferences("ws-1"));
    expect(result.current[0]).toEqual(DEFAULT_PREFERENCES);

    act(() => result.current[1]({ groupBy: "project" }));

    expect(result.current[0].groupBy).toBe("project");
    expect(
      JSON.parse(localStorage.getItem("kaneo:my-tasks:ws-1") ?? "{}").groupBy,
    ).toBe("project");
    expect(localStorage.getItem("kaneo:my-tasks:ws-2")).toBeNull();
  });

  it("restores saved settings and ignores broken storage", () => {
    localStorage.setItem(
      "kaneo:my-tasks:ws-1",
      JSON.stringify({ view: "board", groupBy: "status" }),
    );
    localStorage.setItem("kaneo:my-tasks:ws-2", "{not json");

    expect(
      renderHook(() => useMyTasksPreferences("ws-1")).result.current[0],
    ).toMatchObject({ view: "board", groupBy: "status", completed: "hide" });
    expect(
      renderHook(() => useMyTasksPreferences("ws-2")).result.current[0],
    ).toEqual(DEFAULT_PREFERENCES);
  });

  it("switches to another workspace's settings", () => {
    localStorage.setItem(
      "kaneo:my-tasks:ws-2",
      JSON.stringify({ groupBy: "priority" }),
    );
    const { result, rerender } = renderHook(
      ({ id }) => useMyTasksPreferences(id),
      { initialProps: { id: "ws-1" } },
    );
    rerender({ id: "ws-2" });
    expect(result.current[0].groupBy).toBe("priority");
  });
});
