import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import MyTasksBoard from "@/components/my-tasks/my-tasks-board";
import MyTasksEmpty from "@/components/my-tasks/my-tasks-empty";
import MyTasksList from "@/components/my-tasks/my-tasks-list";
import MyTasksToolbar from "@/components/my-tasks/my-tasks-toolbar";
import ViewSwitch from "@/components/my-tasks/view-switch";
import PageTitle from "@/components/page-title";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import useMyTasks from "@/hooks/queries/my-tasks/use-my-tasks";
import { useMyTasksActions } from "@/hooks/use-my-tasks-actions";
import { useMyTasksLiveUpdates } from "@/hooks/use-my-tasks-live-updates";
import { useMyTasksPreferences } from "@/hooks/use-my-tasks-preferences";
import { useNow } from "@/hooks/use-now";
import { authClient } from "@/lib/auth-client";
import { filterMyTasks, labelOptionsFrom } from "@/lib/my-tasks/filter-tasks";
import { groupLabel } from "@/lib/my-tasks/group-label";
import { groupMyTasks, type TaskGroup } from "@/lib/my-tasks/group-tasks";
import { pruneFilters } from "@/lib/my-tasks/preferences";
import { sortMyTasks } from "@/lib/my-tasks/sort-my-tasks";
import {
  DEFAULT_FILTERS,
  type MyTask,
  type MyTaskProject,
} from "@/lib/my-tasks/types";
import { useUserPreferencesStore } from "@/store/user-preferences";

type MyTasksSearch = { taskId?: string; taskProjectId?: string };

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/my-tasks",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): MyTasksSearch => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
    taskProjectId:
      typeof search.taskProjectId === "string"
        ? search.taskProjectId
        : undefined,
  }),
});

const NO_TASKS: MyTask[] = [];
const NO_PROJECTS: MyTaskProject[] = [];
const SKELETON_ROWS = ["a", "b", "c", "d", "e", "f"];

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { taskId, taskProjectId } = Route.useSearch();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id ?? "";
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const now = useNow();
  const [prefs, updatePrefs] = useMyTasksPreferences(workspaceId);
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useMyTasks(workspaceId, prefs.completed);
  const tasks = data?.tasks ?? NO_TASKS;
  const projects = data?.projects ?? NO_PROJECTS;
  useMyTasksLiveUpdates(
    workspaceId,
    projects.map((project) => project.id),
  );
  const actions = useMyTasksActions(workspaceId, data, prefs.groupBy);

  // Keep the panel's project while it animates closed.
  const [sheetProjectId, setSheetProjectId] = useState(taskProjectId);
  if (taskProjectId && taskProjectId !== sheetProjectId) {
    setSheetProjectId(taskProjectId);
  }

  const showCompleted = prefs.completed !== "hide";
  const filters = useMemo(
    () => pruneFilters(prefs.filters, projects, tasks),
    [prefs.filters, projects, tasks],
  );
  const labelOptions = useMemo(() => labelOptionsFrom(tasks), [tasks]);

  const visible = useMemo(
    () =>
      sortMyTasks(
        filterMyTasks(tasks, filters, {
          userId,
          now,
          weekStartsOn,
          search,
          showCompleted,
        }),
        prefs.sort,
        projects,
      ),
    [
      tasks,
      filters,
      userId,
      now,
      weekStartsOn,
      search,
      showCompleted,
      prefs.sort,
      projects,
    ],
  );

  const hiddenCount =
    filterMyTasks(tasks, DEFAULT_FILTERS, {
      userId,
      now,
      weekStartsOn,
      search: "",
      showCompleted,
    }).length - visible.length;

  const groups = useMemo(
    () =>
      groupMyTasks(visible, prefs.groupBy, {
        projects,
        now,
        weekStartsOn,
        showCompleted,
      }),
    [visible, prefs.groupBy, projects, now, weekStartsOn, showCompleted],
  );

  const openTask = (task: MyTask) =>
    navigate({
      to: ".",
      search: { taskId: task.id, taskProjectId: task.projectId },
    });
  const closeTask = () => navigate({ to: ".", search: {}, replace: true });
  const clearFilters = () => {
    setSearch("");
    updatePrefs({ filters: DEFAULT_FILTERS });
  };
  const handleDrop = (task: MyTask, group: TaskGroup) =>
    actions.drop(task, group.key, groupLabel(prefs.groupBy, group, t));

  const viewProps = {
    groups,
    groupBy: prefs.groupBy,
    projects,
    now,
    onOpen: openTask,
    onToggleComplete: actions.toggleComplete,
  };

  return (
    <>
      <PageTitle title={t("tasks:myTasks.title")} />
      <WorkspaceLayout
        title={t("tasks:myTasks.title")}
        headerActions={
          <ViewSwitch
            view={prefs.view}
            onChange={(view) => updatePrefs({ view })}
          />
        }
      >
        <MyTasksToolbar
          prefs={prefs}
          onChange={updatePrefs}
          search={search}
          onSearchChange={setSearch}
          projects={projects}
          labelOptions={labelOptions}
        />
        {data?.truncated && (
          <p className="pb-2 text-xs text-muted-foreground">
            {t("tasks:myTasks.truncated")}
          </p>
        )}
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {SKELETON_ROWS.map((row) => (
              <Skeleton key={row} className="h-9 w-full" />
            ))}
          </div>
        ) : isError ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("tasks:myTasks.loadFailed")}
          </p>
        ) : visible.length === 0 ? (
          <MyTasksEmpty
            hiddenCount={hiddenCount}
            onClearFilters={clearFilters}
          />
        ) : prefs.view === "board" ? (
          <MyTasksBoard {...viewProps} onDrop={handleDrop} />
        ) : (
          <MyTasksList {...viewProps} />
        )}
      </WorkspaceLayout>
      {sheetProjectId && (
        <TaskDetailsSheet
          taskId={taskId}
          projectId={sheetProjectId}
          workspaceId={workspaceId}
          onClose={closeTask}
        />
      )}
    </>
  );
}
