import type { TFunction } from "i18next";
import { getStatusDisplayLabel } from "@/lib/i18n/domain";
import { BACKLOG_STATUS, type MyTask, type MyTaskProject } from "./types";

// Same key the project board shows, e.g. CNT-4.
export function taskKey(task: MyTask, project?: MyTaskProject): string {
  return project ? `${project.slug}-${task.number}` : `#${task.number}`;
}

export function statusName(
  task: MyTask,
  project: MyTaskProject | undefined,
  t: TFunction,
): string {
  if (task.status === BACKLOG_STATUS) return t("tasks:myTasks.backlog");
  const column = project?.columns.find((c) => c.slug === task.status);
  return getStatusDisplayLabel(task.status, column?.name);
}
