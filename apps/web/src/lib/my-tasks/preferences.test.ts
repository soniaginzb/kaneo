import { describe, expect, it } from "vite-plus/test";
import { normalizePreferences, pruneFilters } from "./preferences";
import { makeProject } from "./test-fixtures";
import {
  DEFAULT_FILTERS,
  DEFAULT_PREFERENCES,
  type MyTasksPreferences,
} from "./types";

describe("normalizePreferences", () => {
  it("falls back to defaults for missing or invalid values", () => {
    expect(normalizePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(normalizePreferences("nope")).toEqual(DEFAULT_PREFERENCES);
    expect(
      normalizePreferences({
        view: "grid",
        groupBy: "colour",
        sort: { field: "size", direction: "up" },
        completed: "week",
        filters: {
          assignee: ["me", "boss"],
          due: ["today", "yesterday"],
          priorities: ["urgent", "meh"],
          projects: ["p1", 3, "p1"],
          labels: "client",
        },
      }),
    ).toEqual({
      view: "list",
      groupBy: "dueDate",
      sort: { field: "dueDate", direction: "asc" },
      completed: "hide",
      filters: {
        assignee: ["me"],
        due: ["today"],
        priorities: ["urgent"],
        projects: ["p1"],
        labels: [],
      },
    });
  });

  it("keeps valid saved values", () => {
    const saved: MyTasksPreferences = {
      view: "board",
      groupBy: "status",
      sort: { field: "priority", direction: "desc" },
      completed: "30d",
      filters: {
        assignee: ["unassigned"],
        projects: ["p2"],
        priorities: ["high"],
        due: ["overdue"],
        labels: ["client"],
      },
    };
    expect(normalizePreferences(JSON.parse(JSON.stringify(saved)))).toEqual(
      saved,
    );
  });
});

describe("pruneFilters", () => {
  it("drops deleted projects but keeps label filters", () => {
    // A label filter whose last task was just completed must keep filtering
    // (showing "hidden by filters"), not silently turn into "everything".
    expect(
      pruneFilters(
        {
          ...DEFAULT_FILTERS,
          projects: ["p1", "gone"],
          labels: ["client", "old"],
        },
        [makeProject({ id: "p1" })],
      ),
    ).toEqual({
      ...DEFAULT_FILTERS,
      projects: ["p1"],
      labels: ["client", "old"],
    });
  });
});
