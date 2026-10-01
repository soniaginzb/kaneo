import { describe, expect, it } from "vite-plus/test";
import {
  completeTarget,
  isDragEnabled,
  reopenTarget,
  resolveDrop,
  toggleCompleteTarget,
} from "./target-status";
import { makeProject, makeTask } from "./test-fixtures";
import { GROUP_BYS } from "./types";

const project = makeProject();
const noDone = makeProject({
  columns: [
    { id: "a", name: "To Do", slug: "to-do", position: 0, isFinal: false },
  ],
});

describe("complete and reopen targets", () => {
  it("uses the first Done-type column and the first open column by position", () => {
    const shuffled = makeProject({
      columns: [
        {
          id: "a",
          name: "Shipped",
          slug: "shipped",
          position: 5,
          isFinal: true,
        },
        { id: "b", name: "Ideas", slug: "ideas", position: 1, isFinal: false },
        { id: "c", name: "Done", slug: "done", position: 3, isFinal: true },
      ],
    });
    expect(completeTarget(shuffled)).toBe("done");
    expect(reopenTarget(shuffled)).toBe("ideas");
  });

  it("toggles according to the task's state", () => {
    expect(toggleCompleteTarget(makeTask(), project)).toBe("done");
    expect(
      toggleCompleteTarget(
        makeTask({ status: "done", completed: true }),
        project,
      ),
    ).toBe("to-do");
  });

  it("returns null without a Done column or a known project", () => {
    expect(completeTarget(noDone)).toBeNull();
    expect(toggleCompleteTarget(makeTask(), undefined)).toBeNull();
  });
});

describe("resolveDrop", () => {
  const task = makeTask({ status: "to-do", priority: "low" });

  it("sets the priority of the target group", () => {
    expect(resolveDrop(task, "priority", "urgent", project)).toEqual({
      kind: "priority",
      priority: "urgent",
    });
    expect(resolveDrop(task, "priority", "low", project)).toEqual({
      kind: "none",
    });
  });

  it("moves to a status only when the task's project has that column", () => {
    expect(resolveDrop(task, "status", "in-progress", project)).toEqual({
      kind: "status",
      status: "in-progress",
    });
    expect(resolveDrop(task, "status", "to-do", project)).toEqual({
      kind: "none",
    });
    expect(resolveDrop(task, "status", "drafting", project)).toEqual({
      kind: "missingColumn",
    });
    expect(resolveDrop(task, "status", "planned", project)).toEqual({
      kind: "status",
      status: "planned",
    });
  });

  it("ignores drops in other groupings", () => {
    expect(resolveDrop(task, "dueDate", "today", project)).toEqual({
      kind: "none",
    });
    expect(resolveDrop(task, "project", "p2", project)).toEqual({
      kind: "none",
    });
  });

  it("enables dragging only for status and priority", () => {
    expect(GROUP_BYS.filter((groupBy) => isDragEnabled(groupBy))).toEqual([
      "priority",
      "status",
    ]);
  });
});
