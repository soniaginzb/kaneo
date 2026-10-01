import { describe, expect, it } from "vite-plus/test";
import { sortMyTasks } from "./sort-my-tasks";
import { makeProject, makeTask } from "./test-fixtures";
import type { MyTask } from "./types";

const projects = [
  makeProject({ id: "p1", name: "Content", position: 1 }),
  makeProject({ id: "p2", name: "Client A", position: 0 }),
];
const ids = (list: MyTask[]) => list.map((task) => task.id);

describe("sortMyTasks", () => {
  it("sorts by due date with undated tasks last in both directions", () => {
    const list = [
      makeTask({ id: "none", dueDate: null }),
      makeTask({ id: "late", dueDate: "2026-10-09T00:00:00.000Z" }),
      makeTask({ id: "soon", dueDate: "2026-10-08T00:00:00.000Z" }),
    ];
    expect(
      ids(sortMyTasks(list, { field: "dueDate", direction: "asc" }, projects)),
    ).toEqual(["soon", "late", "none"]);
    expect(
      ids(sortMyTasks(list, { field: "dueDate", direction: "desc" }, projects)),
    ).toEqual(["late", "soon", "none"]);
  });

  it("puts the most urgent first when ascending", () => {
    const list = ["low", "no-priority", "urgent", "medium", "high"].map(
      (priority) => makeTask({ id: priority, priority }),
    );
    expect(
      ids(sortMyTasks(list, { field: "priority", direction: "asc" }, projects)),
    ).toEqual(["urgent", "high", "medium", "low", "no-priority"]);
    expect(
      ids(
        sortMyTasks(list, { field: "priority", direction: "desc" }, projects),
      ),
    ).toEqual(["no-priority", "low", "medium", "high", "urgent"]);
  });

  it("breaks ties by project order, then task number", () => {
    const list = [
      makeTask({ id: "x", title: "Same", projectId: "p1", number: 1 }),
      makeTask({ id: "y", title: "Same", projectId: "p2", number: 9 }),
      makeTask({ id: "z", title: "Same", projectId: "p2", number: 3 }),
    ];
    expect(
      ids(sortMyTasks(list, { field: "title", direction: "asc" }, projects)),
    ).toEqual(["z", "y", "x"]);
  });

  it("sorts titles ignoring case, by project order, and by creation", () => {
    const list = [
      makeTask({
        id: "banana",
        title: "banana",
        projectId: "p1",
        createdAt: "2026-10-03T00:00:00.000Z",
      }),
      makeTask({
        id: "Apple",
        title: "Apple",
        projectId: "p2",
        createdAt: "2026-10-02T00:00:00.000Z",
      }),
      makeTask({
        id: "cherry",
        title: "cherry",
        projectId: "p1",
        createdAt: "2026-10-01T00:00:00.000Z",
      }),
    ];
    expect(
      ids(sortMyTasks(list, { field: "title", direction: "asc" }, projects)),
    ).toEqual(["Apple", "banana", "cherry"]);
    expect(
      ids(sortMyTasks(list, { field: "project", direction: "asc" }, projects)),
    ).toEqual(["Apple", "banana", "cherry"]);
    expect(
      ids(
        sortMyTasks(list, { field: "createdAt", direction: "desc" }, projects),
      ),
    ).toEqual(["banana", "Apple", "cherry"]);
  });

  it("leaves the input array untouched", () => {
    const list = [
      makeTask({ id: "b", title: "b" }),
      makeTask({ id: "a", title: "a" }),
    ];
    sortMyTasks(list, { field: "title", direction: "asc" }, projects);
    expect(ids(list)).toEqual(["b", "a"]);
  });
});
