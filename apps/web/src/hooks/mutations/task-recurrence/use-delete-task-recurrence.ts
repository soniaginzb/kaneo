import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteTaskRecurrence from "@/fetchers/task-recurrence/delete-task-recurrence";

export function useDeleteTaskRecurrence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId }: { taskId: string; projectId: string }) =>
      deleteTaskRecurrence(taskId),
    onSuccess: (_result, variables) => {
      queryClient.setQueryData(["task-recurrence", variables.taskId], {
        recurrence: null,
      });
      queryClient.invalidateQueries({
        queryKey: ["task-recurrence", "project", variables.projectId],
      });
    },
  });
}
