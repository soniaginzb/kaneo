import type { MyTasksData } from "./types";

export type MyTaskChange = {
  taskId: string;
  projectId: string;
  status?: string;
  priority?: string;
};

export function applyMyTaskChange(
  data: MyTasksData,
  change: MyTaskChange,
  now: Date,
): MyTasksData {
  const project = data.projects.find((p) => p.id === change.projectId);
  return {
    ...data,
    tasks: data.tasks.map((task) => {
      if (task.id !== change.taskId) return task;
      const next = { ...task };
      if (change.priority !== undefined) next.priority = change.priority;
      if (change.status !== undefined) {
        next.status = change.status;
        next.completed =
          project?.columns.some(
            (column) => column.slug === change.status && column.isFinal,
          ) ?? false;
        next.completedAt = next.completed
          ? (task.completedAt ?? now.toISOString())
          : null;
      }
      return next;
    }),
  };
}
