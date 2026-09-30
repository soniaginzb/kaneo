import { useQuery } from "@tanstack/react-query";
import getTaskRecurrence from "@/fetchers/task-recurrence/get-task-recurrence";

function useGetTaskRecurrence(taskId: string) {
  return useQuery({
    queryKey: ["task-recurrence", taskId],
    queryFn: () => getTaskRecurrence(taskId),
    enabled: !!taskId,
  });
}

export default useGetTaskRecurrence;
