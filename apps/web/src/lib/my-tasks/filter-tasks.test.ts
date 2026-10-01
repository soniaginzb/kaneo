import { describe, expect, it } from "vite-plus/test";
import {
  countActiveFilters,
  type FilterOptions,
  filterMyTasks,
  labelOptionsFrom,
} from "./filter-tasks";
import { makeTask } from "./test-fixtures";
import { DEFAULT_FILTERS, DEFAULT_PREFERENCES, type MyTask } from "./types";

const local = (month: number, day: number) =>
  new Date(2026, month - 1, day).toISOString();
const options: FilterOptions = {
  userId: "me",
  now: new Date(2026, 9, 7, 10),
  weekStartsOn: 1,
  search: "",
  showCompleted: false,
};
const me = { id: "me", name: "Sonia", image: null };

const tasks: MyTask[] = [
  makeTask({
    id: "a",
    title: "Write Typeshare post",
    assignee: me,
    priority: "high",
    dueDate: local(10, 6),
    labels: [{ id: "l1", name: "Client ", color: "#f00" }],
  }),
  makeTask({
    id: "b",
    title: "Invoice client",
    projectId: "p2",
    priority: "low",
    dueDate: local(10, 7),
  }),
  makeTask({
    id: "c",
    title: "Old draft",
    assignee: me,
    status: "done",
    completed: true,
    dueDate: local(10, 1),
  }),
  makeTask({
    id: "d",
    title: "Someday idea",
    assignee: { id: "other", name: "Other", image: null },
  }),
];
const ids = (list: MyTask[]) => list.map((task) => task.id);

describe("filterMyTasks", () => {
  it("hides completed tasks unless they are asked for", () => {
    expect(ids(filterMyTasks(tasks, DEFAULT_FILTERS, options))).toEqual([
      "a",
      "b",
      "d",
    ]);
    expect(
      ids(
        filterMyTasks(tasks, DEFAULT_FILTERS, {
          ...options,
          showCompleted: true,
        }),
      ),
    ).toEqual(["a", "b", "c", "d"]);
  });

  it("matches the search on titles, ignoring case and spaces", () => {
    expect(
      ids(
        filterMyTasks(tasks, DEFAULT_FILTERS, {
          ...options,
          search: "  TYPESHARE ",
        }),
      ),
    ).toEqual(["a"]);
  });

  it("filters by assignee", () => {
    const run = (assignee: Array<"me" | "unassigned">) =>
      ids(filterMyTasks(tasks, { ...DEFAULT_FILTERS, assignee }, options));
    expect(run(["me"])).toEqual(["a"]);
    expect(run(["unassigned"])).toEqual(["b"]);
    expect(run(["me", "unassigned"])).toEqual(["a", "b"]);
  });

  it("filters by project and priority", () => {
    expect(
      ids(
        filterMyTasks(tasks, { ...DEFAULT_FILTERS, projects: ["p2"] }, options),
      ),
    ).toEqual(["b"]);
    expect(
      ids(
        filterMyTasks(
          tasks,
          { ...DEFAULT_FILTERS, priorities: ["high", "low"] },
          options,
        ),
      ),
    ).toEqual(["a", "b"]);
  });

  it("never treats a completed task as overdue", () => {
    expect(
      ids(
        filterMyTasks(
          tasks,
          { ...DEFAULT_FILTERS, due: ["overdue"] },
          { ...options, showCompleted: true },
        ),
      ),
    ).toEqual(["a"]);
    expect(
      ids(
        filterMyTasks(
          tasks,
          { ...DEFAULT_FILTERS, due: ["today", "noDate"] },
          options,
        ),
      ),
    ).toEqual(["b", "d"]);
  });

  it("matches labels by name across projects", () => {
    expect(
      ids(
        filterMyTasks(
          tasks,
          { ...DEFAULT_FILTERS, labels: ["client"] },
          options,
        ),
      ),
    ).toEqual(["a"]);
  });
});

describe("labelOptionsFrom", () => {
  it("lists each label name once, sorted", () => {
    expect(
      labelOptionsFrom([
        makeTask({ labels: [{ id: "1", name: "Draft", color: "#0f0" }] }),
        makeTask({ labels: [{ id: "2", name: "Client ", color: "#f00" }] }),
        makeTask({ labels: [{ id: "3", name: "client", color: "#00f" }] }),
      ]),
    ).toEqual([
      { key: "client", name: "Client" },
      { key: "draft", name: "Draft" },
    ]);
  });
});

describe("countActiveFilters", () => {
  it("counts each selected value and a visible completed window", () => {
    expect(countActiveFilters(DEFAULT_PREFERENCES)).toBe(0);
    expect(
      countActiveFilters({
        ...DEFAULT_PREFERENCES,
        filters: {
          ...DEFAULT_FILTERS,
          projects: ["p2"],
          due: ["today", "overdue"],
        },
        completed: "7d",
      }),
    ).toBe(4);
  });
});
