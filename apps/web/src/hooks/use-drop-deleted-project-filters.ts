import { useEffect } from "react";
import { pruneFilters } from "@/lib/my-tasks/preferences";
import type { MyTaskProject, MyTasksPreferences } from "@/lib/my-tasks/types";

// Once the project list is known, saves the filters without deleted projects,
// so the filter count, chips and stored settings all agree with the list.
export function useDropDeletedProjectFilters(
  prefs: MyTasksPreferences,
  projects: MyTaskProject[] | undefined,
  update: (patch: Partial<MyTasksPreferences>) => void,
) {
  useEffect(() => {
    if (!projects) return;
    const pruned = pruneFilters(prefs.filters, projects);
    if (pruned.projects.length !== prefs.filters.projects.length) {
      update({ filters: pruned });
    }
  }, [prefs.filters, projects, update]);
}
