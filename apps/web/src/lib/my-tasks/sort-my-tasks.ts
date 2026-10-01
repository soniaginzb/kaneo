import type { MyTask, MyTaskProject, MyTasksSort } from "./types";

const PRIORITY_RANK: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const rank = (priority: string) => PRIORITY_RANK[priority] ?? 0;

export function sortMyTasks(
  tasks: MyTask[],
  sort: MyTasksSort,
  projects: MyTaskProject[],
): MyTask[] {
  const positions = new Map(projects.map((p) => [p.id, p.position]));
  const names = new Map(projects.map((p) => [p.id, p.name]));
  const position = (task: MyTask) =>
    positions.get(task.projectId) ?? Number.MAX_SAFE_INTEGER;
  const sign = sort.direction === "asc" ? 1 : -1;

  const primary = (a: MyTask, b: MyTask): number => {
    switch (sort.field) {
      case "dueDate":
        if (!a.dueDate || !b.dueDate) return 0;
        return sign * (Date.parse(a.dueDate) - Date.parse(b.dueDate));
      case "priority":
        // Ascending = most urgent first.
        return sign * (rank(b.priority) - rank(a.priority));
      case "project":
        return (
          sign *
          (position(a) - position(b) ||
            (names.get(a.projectId) ?? "").localeCompare(
              names.get(b.projectId) ?? "",
            ))
        );
      case "createdAt":
        return sign * (Date.parse(a.createdAt) - Date.parse(b.createdAt));
      case "title":
        return (
          sign *
          a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
        );
    }
  };

  return [...tasks].sort((a, b) => {
    // Undated tasks stay at the bottom whichever way due dates are sorted.
    if (sort.field === "dueDate" && !a.dueDate !== !b.dueDate) {
      return a.dueDate ? -1 : 1;
    }
    return (
      primary(a, b) ||
      position(a) - position(b) ||
      (a.number ?? 0) - (b.number ?? 0) ||
      a.id.localeCompare(b.id)
    );
  });
}
