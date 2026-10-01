import { labelKey } from "./filter-tasks";
import {
  ASSIGNEE_FILTERS,
  COMPLETED_WINDOWS,
  DEFAULT_PREFERENCES,
  DUE_FILTERS,
  GROUP_BYS,
  type MyTask,
  type MyTaskProject,
  type MyTasksFilters,
  type MyTasksPreferences,
  PRIORITIES,
  SORT_FIELDS,
} from "./types";

function pick<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function list<T extends string>(value: unknown, allowed?: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  const valid = value.filter(
    (item): item is T =>
      typeof item === "string" && (!allowed || allowed.includes(item as T)),
  );
  return [...new Set(valid)];
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

export function normalizePreferences(raw: unknown): MyTasksPreferences {
  if (!raw || typeof raw !== "object") return DEFAULT_PREFERENCES;
  const saved = asRecord(raw);
  const sort = asRecord(saved.sort);
  const filters = asRecord(saved.filters);
  return {
    view: pick(saved.view, ["list", "board"] as const, "list"),
    groupBy: pick(saved.groupBy, GROUP_BYS, "dueDate"),
    sort: {
      field: pick(sort.field, SORT_FIELDS, "dueDate"),
      direction: pick(sort.direction, ["asc", "desc"] as const, "asc"),
    },
    filters: {
      assignee: list(filters.assignee, ASSIGNEE_FILTERS),
      projects: list(filters.projects),
      priorities: list(filters.priorities, PRIORITIES),
      due: list(filters.due, DUE_FILTERS),
      labels: list(filters.labels),
    },
    completed: pick(saved.completed, COMPLETED_WINDOWS, "hide"),
  };
}

// Saved filters can point at projects or labels deleted since; ignore those.
export function pruneFilters(
  filters: MyTasksFilters,
  projects: MyTaskProject[],
  tasks: MyTask[],
): MyTasksFilters {
  const projectIds = new Set(projects.map((project) => project.id));
  const labelKeys = new Set(
    tasks.flatMap((task) => task.labels.map((label) => labelKey(label.name))),
  );
  return {
    ...filters,
    projects: filters.projects.filter((id) => projectIds.has(id)),
    labels: filters.labels.filter((key) => labelKeys.has(key)),
  };
}
