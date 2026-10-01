import type { MyTask, MyTaskProject } from "./types";

export function makeProject(
  overrides: Partial<MyTaskProject> = {},
): MyTaskProject {
  return {
    id: "p1",
    name: "Content",
    slug: "CNT",
    icon: "Folder",
    position: 0,
    columns: [
      { id: "c1", name: "To Do", slug: "to-do", position: 0, isFinal: false },
      {
        id: "c2",
        name: "In Progress",
        slug: "in-progress",
        position: 1,
        isFinal: false,
      },
      { id: "c3", name: "Done", slug: "done", position: 2, isFinal: true },
    ],
    ...overrides,
  };
}

export function makeTask(overrides: Partial<MyTask> = {}): MyTask {
  return {
    id: "t1",
    number: 1,
    title: "Write post",
    status: "to-do",
    priority: "medium",
    startDate: null,
    dueDate: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    projectId: "p1",
    assignee: null,
    labels: [],
    parent: null,
    isRecurring: false,
    completed: false,
    completedAt: null,
    ...overrides,
  };
}
