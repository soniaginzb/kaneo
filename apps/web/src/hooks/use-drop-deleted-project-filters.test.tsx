import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { makeProject } from "@/lib/my-tasks/test-fixtures";
import {
  DEFAULT_FILTERS,
  DEFAULT_PREFERENCES,
  type MyTasksPreferences,
} from "@/lib/my-tasks/types";
import { useDropDeletedProjectFilters } from "./use-drop-deleted-project-filters";

afterEach(cleanup);

const prefs: MyTasksPreferences = {
  ...DEFAULT_PREFERENCES,
  filters: { ...DEFAULT_FILTERS, projects: ["p1", "gone"], labels: ["old"] },
};

describe("useDropDeletedProjectFilters", () => {
  it("saves the filters without projects that no longer exist", () => {
    const update = vi.fn();
    renderHook(() =>
      useDropDeletedProjectFilters(prefs, [makeProject({ id: "p1" })], update),
    );
    expect(update).toHaveBeenCalledWith({
      filters: { ...prefs.filters, projects: ["p1"] },
    });
  });

  it("waits for the project list and leaves valid filters alone", () => {
    const update = vi.fn();
    renderHook(() => useDropDeletedProjectFilters(prefs, undefined, update));
    renderHook(() =>
      useDropDeletedProjectFilters(
        prefs,
        [makeProject({ id: "p1" }), makeProject({ id: "gone" })],
        update,
      ),
    );
    expect(update).not.toHaveBeenCalled();
  });
});
