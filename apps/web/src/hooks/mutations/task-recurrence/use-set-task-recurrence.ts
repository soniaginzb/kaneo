import { useMutation, useQueryClient } from "@tanstack/react-query";
import setTaskRecurrence from "@/fetchers/task-recurrence/set-task-recurrence";

export function useSetTaskRecurrence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      rrule,
      timeZone,
    }: {
      taskId: string;
      projectId: string;
      rrule: string;
      timeZone: string;
    }) => setTaskRecurrence(taskId, { rrule, timeZone }),
    onSuccess: (recurrence, variables) => {
      queryClient.setQueryData(["task-recurrence", variables.taskId], {
        recurrence,
      });
      queryClient.invalidateQueries({
        queryKey: ["task-recurrence", "project", variables.projectId],
      });
    },
  });
}
