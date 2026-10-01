import { describe, expect, it } from "vite-plus/test";
import { myTasksPageState } from "./page-state";

describe("myTasksPageState", () => {
  it("shows loading, then tasks or the empty state", () => {
    expect(
      myTasksPageState({
        isLoading: true,
        isError: false,
        hasData: false,
        visibleCount: 0,
      }),
    ).toBe("loading");
    expect(
      myTasksPageState({
        isLoading: false,
        isError: false,
        hasData: true,
        visibleCount: 3,
      }),
    ).toBe("tasks");
    expect(
      myTasksPageState({
        isLoading: false,
        isError: false,
        hasData: true,
        visibleCount: 0,
      }),
    ).toBe("empty");
  });

  it("keeps showing loaded tasks when a background refresh fails", () => {
    expect(
      myTasksPageState({
        isLoading: false,
        isError: true,
        hasData: true,
        visibleCount: 3,
      }),
    ).toBe("tasks");
    expect(
      myTasksPageState({
        isLoading: false,
        isError: true,
        hasData: false,
        visibleCount: 0,
      }),
    ).toBe("error");
  });
});
