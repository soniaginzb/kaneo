import type { TFunction } from "i18next";
import { getStatusDisplayLabel } from "@/lib/i18n/domain";
import type { TaskGroup } from "./group-tasks";
import { BACKLOG_STATUS, type GroupBy } from "./types";

export function groupLabel(
  groupBy: GroupBy,
  group: TaskGroup,
  t: TFunction,
): string {
  switch (groupBy) {
    case "dueDate":
      return t(`tasks:myTasks.due.${group.key}`);
    case "priority":
      return t(`tasks:priority.${group.key}`);
    case "project":
      return group.name ?? group.key;
    case "status":
      return group.key === BACKLOG_STATUS
        ? t("tasks:myTasks.backlog")
        : getStatusDisplayLabel(group.key, group.name ?? undefined);
    case "none":
      return t("tasks:myTasks.allTasks");
  }
}
