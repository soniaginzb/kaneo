import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateMyTaskPriority from "@/fetchers/my-tasks/update-my-task-priority";
import updateTaskStatus from "@/fetchers/task/update-task-status";
import { myTasksKey } from "@/hooks/queries/my-tasks/use-my-tasks";
import {
  applyMyTaskChange,
  type MyTaskChange,
} from "@/lib/my-tasks/apply-change";
import type { MyTasksData } from "@/lib/my-tasks/types";

// Saves through the same endpoints as project boards, so activity, repeats and
// websocket broadcasts behave the same; the list updates before the server answers.
function useUpdateMyTask(workspaceId: string) {
  const queryClient = useQueryClient();
  const key = myTasksKey(workspaceId);

  return useMutation({
    mutationFn: async (change: MyTaskChange) => {
      if (change.status !== undefined) {
        await updateTaskStatus(change.taskId, { status: change.status });
      }
      if (change.priority !== undefined) {
        await updateMyTaskPriority(change.taskId, change.priority);
      }
    },
    onMutate: async (change) => {
      await queryClient.cancelQueries({ queryKey: key });
      const snapshots = queryClient.getQueriesData<MyTasksData>({
        queryKey: key,
      });
      queryClient.setQueriesData<MyTasksData>({ queryKey: key }, (data) =>
        data ? applyMyTaskChange(data, change, new Date()) : data,
      );
      return { snapshots };
    },
    onError: (_error, _change, context) => {
      for (const [queryKey, data] of context?.snapshots ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    onSettled: (_data, _error, change) => {
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({
        queryKey: ["tasks", change.projectId],
      });
      void queryClient.invalidateQueries({ queryKey: ["task", change.taskId] });
    },
  });
}

export default useUpdateMyTask;
