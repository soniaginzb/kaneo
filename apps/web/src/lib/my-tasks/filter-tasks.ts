import type { WeekStartDay } from "@/store/user-preferences";
import { dueBucket } from "./due-bucket";
import type { MyTask, MyTasksFilters, MyTasksPreferences } from "./types";

export type FilterOptions = {
  userId: string;
  now: Date;
  weekStartsOn: WeekStartDay;
  search: string;
  showCompleted: boolean;
};

export type LabelOption = { key: string; name: string };

export const labelKey = (name: string) => name.trim().toLowerCase();

export function filterMyTasks(
  tasks: MyTask[],
  filters: MyTasksFilters,
  options: FilterOptions,
): MyTask[] {
  const query = options.search.trim().toLowerCase();

  return tasks.filter((task) => {
    if (!options.showCompleted && task.completed) return false;
    if (query && !task.title.toLowerCase().includes(query)) return false;

    if (filters.assignee.length > 0) {
      const mine =
        filters.assignee.includes("me") && task.assignee?.id === options.userId;
      const unassigned =
        filters.assignee.includes("unassigned") && task.assignee === null;
      if (!mine && !unassigned) return false;
    }

    if (
      filters.projects.length > 0 &&
      !filters.projects.includes(task.projectId)
    ) {
      return false;
    }

    if (
      filters.priorities.length > 0 &&
      !filters.priorities.includes(task.priority)
    ) {
      return false;
    }

    if (filters.due.length > 0) {
      const bucket = dueBucket(task.dueDate, options.now, options.weekStartsOn);
      const matches = filters.due.some((due) =>
        due === "overdue"
          ? bucket === "overdue" && !task.completed
          : due === bucket,
      );
      if (!matches) return false;
    }

    if (
      filters.labels.length > 0 &&
      !task.labels.some((label) =>
        filters.labels.includes(labelKey(label.name)),
      )
    ) {
      return false;
    }

    return true;
  });
}

export function labelOptionsFrom(tasks: MyTask[]): LabelOption[] {
  const options = new Map<string, LabelOption>();
  for (const task of tasks) {
    for (const label of task.labels) {
      const key = labelKey(label.name);
      if (!options.has(key)) options.set(key, { key, name: label.name.trim() });
    }
  }
  return [...options.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function countActiveFilters(prefs: MyTasksPreferences): number {
  const { filters } = prefs;
  return (
    filters.assignee.length +
    filters.projects.length +
    filters.priorities.length +
    filters.due.length +
    filters.labels.length +
    (prefs.completed === "hide" ? 0 : 1)
  );
}
