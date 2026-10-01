import type { TFunction } from "i18next";
import type { LabelOption } from "./filter-tasks";
import type {
  MyTaskProject,
  MyTasksFilters,
  MyTasksPreferences,
} from "./types";

export type FilterChip = {
  key: string;
  label: string;
  next: Partial<MyTasksPreferences>;
};

export function filterChips(
  prefs: MyTasksPreferences,
  projects: MyTaskProject[],
  labelOptions: LabelOption[],
  t: TFunction,
): FilterChip[] {
  const { filters } = prefs;
  const without = (
    field: keyof MyTasksFilters,
    value: string,
  ): Partial<MyTasksPreferences> => ({
    filters: {
      ...filters,
      [field]: (filters[field] as string[]).filter((item) => item !== value),
    } as MyTasksFilters,
  });
  const chips: FilterChip[] = [];

  for (const value of filters.assignee) {
    chips.push({
      key: `assignee:${value}`,
      label: t(`tasks:myTasks.assignee.${value}`),
      next: without("assignee", value),
    });
  }
  for (const id of filters.projects) {
    const project = projects.find((p) => p.id === id);
    if (!project) continue;
    chips.push({
      key: `project:${id}`,
      label: project.name,
      next: without("projects", id),
    });
  }
  for (const value of filters.priorities) {
    chips.push({
      key: `priority:${value}`,
      label: t(`tasks:priority.${value}`),
      next: without("priorities", value),
    });
  }
  for (const value of filters.due) {
    chips.push({
      key: `due:${value}`,
      label: t(`tasks:myTasks.due.${value}`),
      next: without("due", value),
    });
  }
  for (const key of filters.labels) {
    chips.push({
      key: `label:${key}`,
      label: labelOptions.find((option) => option.key === key)?.name ?? key,
      next: without("labels", key),
    });
  }
  if (prefs.completed !== "hide") {
    chips.push({
      key: "completed",
      label: `${t("tasks:myTasks.filter.completed")}: ${t(`tasks:myTasks.completed.${prefs.completed}`)}`,
      next: { completed: "hide" },
    });
  }
  return chips;
}
