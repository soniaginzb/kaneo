import { describe, expect, it } from "vite-plus/test";
import { type GroupOptions, groupMyTasks } from "./group-tasks";
import { makeProject, makeTask } from "./test-fixtures";

const local = (month: number, day: number) =>
  new Date(2026, month - 1, day).toISOString();
const content = makeProject({ id: "p1", name: "Content", position: 1 });
const client = makeProject({
  id: "p2",
  name: "Client A",
  position: 0,
  columns: [
    { id: "k1", name: "Queue", slug: "to-do", position: 0, isFinal: false },
    {
      id: "k2",
      name: "Drafting",
      slug: "drafting",
      position: 1,
      isFinal: false,
    },
    { id: "k3", name: "Done", slug: "done", position: 2, isFinal: true },
  ],
});
const options: GroupOptions = {
  projects: [content, client],
  now: new Date(2026, 9, 7, 10),
  weekStartsOn: 1,
  showCompleted: false,
};
const summary = (groups: ReturnType<typeof groupMyTasks>) =>
  groups.map((group) => [group.key, group.tasks.map((task) => task.id)]);

describe("groupMyTasks", () => {
  it("always lists the six due-date groups in order", () => {
    const groups = groupMyTasks(
      [
        makeTask({ id: "late", dueDate: local(10, 6) }),
        makeTask({ id: "now", dueDate: local(10, 7) }),
        makeTask({ id: "free" }),
      ],
      "dueDate",
      options,
    );
    expect(summary(groups)).toEqual([
      ["overdue", ["late"]],
      ["today", ["now"]],
      ["thisWeek", []],
      ["nextWeek", []],
      ["later", []],
      ["noDate", ["free"]],
    ]);
  });

  it("adds a Completed group holding every completed task", () => {
    const groups = groupMyTasks(
      [makeTask({ id: "done", completed: true, dueDate: local(10, 1) })],
      "dueDate",
      { ...options, showCompleted: true },
    );
    expect(groups.at(-1)).toMatchObject({ key: "completed" });
    expect(summary(groups).find(([key]) => key === "overdue")).toEqual([
      "overdue",
      [],
    ]);
    expect(groups.at(-1)?.tasks.map((task) => task.id)).toEqual(["done"]);
  });

  it("keeps the given order inside each group", () => {
    const groups = groupMyTasks(
      [makeTask({ id: "b" }), makeTask({ id: "a" })],
      "none",
      options,
    );
    expect(summary(groups)).toEqual([["all", ["b", "a"]]]);
  });

  it("lists the five priorities, treating unknown values as No priority", () => {
    const groups = groupMyTasks(
      [
        makeTask({ id: "u", priority: "urgent" }),
        makeTask({ id: "x", priority: "weird" }),
      ],
      "priority",
      options,
    );
    expect(summary(groups)).toEqual([
      ["urgent", ["u"]],
      ["high", []],
      ["medium", []],
      ["low", []],
      ["no-priority", ["x"]],
    ]);
  });

  it("groups by project in sidebar order and skips empty projects", () => {
    const groups = groupMyTasks(
      [
        makeTask({ id: "c", projectId: "p1" }),
        makeTask({ id: "k", projectId: "p2" }),
      ],
      "project",
      options,
    );
    expect(groups.map((group) => [group.key, group.name])).toEqual([
      ["p2", "Client A"],
      ["p1", "Content"],
    ]);
    expect(
      groupMyTasks([makeTask({ projectId: "p1" })], "project", options).map(
        (group) => group.key,
      ),
    ).toEqual(["p1"]);
  });

  it("lists every column's status, even with no tasks, so boards have drop targets", () => {
    const groups = groupMyTasks(
      [makeTask({ id: "todo", status: "to-do", projectId: "p1" })],
      "status",
      options,
    );
    expect(summary(groups)).toEqual([
      ["to-do", ["todo"]],
      ["drafting", []],
      ["in-progress", []],
      ["done", []],
    ]);
  });

  it("merges same-slug statuses across projects, Backlog first", () => {
    const groups = groupMyTasks(
      [
        makeTask({ id: "todo", status: "to-do", projectId: "p1" }),
        makeTask({ id: "draft", status: "drafting", projectId: "p2" }),
        makeTask({ id: "doing", status: "in-progress", projectId: "p1" }),
        makeTask({
          id: "shipped",
          status: "done",
          projectId: "p2",
          completed: true,
        }),
        makeTask({ id: "idea", status: "planned", projectId: "p1" }),
        makeTask({ id: "odd", status: "qa", projectId: "p1" }),
      ],
      "status",
      options,
    );
    expect(groups.map((group) => [group.key, group.name])).toEqual([
      ["planned", null],
      ["to-do", "Queue"],
      ["drafting", "Drafting"],
      ["in-progress", "In Progress"],
      ["done", "Done"],
      ["qa", "qa"],
    ]);
  });
});
