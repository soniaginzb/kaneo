import { useTranslation } from "react-i18next";
import useUpdateMyTask from "@/hooks/mutations/my-tasks/use-update-my-task";
import {
  resolveDrop,
  toggleCompleteTarget,
} from "@/lib/my-tasks/target-status";
import type { GroupBy, MyTask, MyTasksData } from "@/lib/my-tasks/types";
import { toast } from "@/lib/toast";

export function useMyTasksActions(
  workspaceId: string,
  data: MyTasksData | undefined,
  groupBy: GroupBy,
) {
  const { t } = useTranslation();
  const { mutate } = useUpdateMyTask(workspaceId);
  const projectOf = (task: MyTask) =>
    data?.projects.find((project) => project.id === task.projectId);
  const onError = () => {
    toast.error(t("tasks:myTasks.updateFailed"));
  };

  const toggleComplete = (task: MyTask) => {
    const status = toggleCompleteTarget(task, projectOf(task));
    if (!status) return;
    mutate({ taskId: task.id, projectId: task.projectId, status }, { onError });
  };

  const drop = (task: MyTask, groupKey: string, groupName: string) => {
    const project = projectOf(task);
    const result = resolveDrop(task, groupBy, groupKey, project);
    const target = { taskId: task.id, projectId: task.projectId };
    if (result.kind === "status") {
      mutate({ ...target, status: result.status }, { onError });
    } else if (result.kind === "priority") {
      mutate({ ...target, priority: result.priority }, { onError });
    } else if (result.kind === "missingColumn") {
      toast.error(
        t("tasks:myTasks.missingColumn", {
          project: project?.name ?? "",
          column: groupName,
        }),
      );
    }
  };

  return { toggleComplete, drop };
}
