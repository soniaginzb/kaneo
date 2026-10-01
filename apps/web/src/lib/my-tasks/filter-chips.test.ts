import type { TFunction } from "i18next";
import { describe, expect, it } from "vite-plus/test";
import { filterChips } from "./filter-chips";
import { makeProject } from "./test-fixtures";
import { DEFAULT_PREFERENCES, type MyTasksPreferences } from "./types";

const t = ((key: string) => key) as unknown as TFunction;
const prefs: MyTasksPreferences = {
  ...DEFAULT_PREFERENCES,
  completed: "7d",
  filters: {
    assignee: ["me"],
    projects: ["p1", "gone"],
    priorities: ["high"],
    due: ["today"],
    labels: ["client"],
  },
};

describe("filterChips", () => {
  it("names every active filter and skips unknown projects", () => {
    const chips = filterChips(
      prefs,
      [makeProject()],
      [{ key: "client", name: "Client" }],
      t,
    );
    expect(chips.map((chip) => chip.label)).toEqual([
      "tasks:myTasks.assignee.me",
      "Content",
      "tasks:priority.high",
      "tasks:myTasks.due.today",
      "Client",
      "tasks:myTasks.filter.completed: tasks:myTasks.completed.7d",
    ]);
  });

  it("removes just its own value", () => {
    const chips = filterChips(prefs, [makeProject()], [], t);
    expect(chips.find((chip) => chip.label === "Content")?.next).toEqual({
      filters: { ...prefs.filters, projects: ["gone"] },
    });
    expect(chips.at(-1)?.next).toEqual({ completed: "hide" });
  });
});
