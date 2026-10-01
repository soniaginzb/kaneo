import {
  BACKLOG_STATUS,
  type GroupBy,
  type MyTask,
  type MyTaskProject,
} from "./types";

const sortedColumns = (project?: MyTaskProject) =>
  [...(project?.columns ?? [])].sort((a, b) => a.position - b.position);

export function completeTarget(project?: MyTaskProject): string | null {
  return sortedColumns(project).find((column) => column.isFinal)?.slug ?? null;
}

export function reopenTarget(project?: MyTaskProject): string | null {
  return sortedColumns(project).find((column) => !column.isFinal)?.slug ?? null;
}

export function toggleCompleteTarget(
  task: MyTask,
  project?: MyTaskProject,
): string | null {
  return task.completed ? reopenTarget(project) : completeTarget(project);
}

export type DropResult =
  | { kind: "none" }
  | { kind: "status"; status: string }
  | { kind: "priority"; priority: string }
  | { kind: "missingColumn" };

export const isDragEnabled = (groupBy: GroupBy) =>
  groupBy === "status" || groupBy === "priority";

export function resolveDrop(
  task: MyTask,
  groupBy: GroupBy,
  groupKey: string,
  project?: MyTaskProject,
): DropResult {
  if (groupBy === "priority") {
    return groupKey === task.priority
      ? { kind: "none" }
      : { kind: "priority", priority: groupKey };
  }
  if (groupBy === "status") {
    if (groupKey === task.status) return { kind: "none" };
    if (groupKey === BACKLOG_STATUS) {
      return { kind: "status", status: BACKLOG_STATUS };
    }
    return project?.columns.some((column) => column.slug === groupKey)
      ? { kind: "status", status: groupKey }
      : { kind: "missingColumn" };
  }
  return { kind: "none" };
}
