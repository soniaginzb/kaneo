import type { TFunction } from "i18next";
import { describe, expect, it } from "vite-plus/test";
import { groupLabel } from "./group-label";
import { makeTask } from "./test-fixtures";

const t = ((key: string) => key) as unknown as TFunction;
const group = (key: string, name: string | null = null) => ({
  key,
  name,
  tasks: [makeTask()],
});

describe("groupLabel", () => {
  it("translates due-date, priority, backlog and none groups", () => {
    expect(groupLabel("dueDate", group("thisWeek"), t)).toBe(
      "tasks:myTasks.due.thisWeek",
    );
    expect(groupLabel("priority", group("urgent"), t)).toBe(
      "tasks:priority.urgent",
    );
    expect(groupLabel("status", group("planned"), t)).toBe(
      "tasks:myTasks.backlog",
    );
    expect(groupLabel("none", group("all"), t)).toBe("tasks:myTasks.allTasks");
  });

  it("uses project and custom column names as they are", () => {
    expect(groupLabel("project", group("p1", "Content"), t)).toBe("Content");
    expect(groupLabel("status", group("drafting", "Drafting"), t)).toBe(
      "Drafting",
    );
  });
});
