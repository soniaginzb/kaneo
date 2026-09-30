import { useQuery } from "@tanstack/react-query";
import getProjectRecurringTaskIds from "@/fetchers/task-recurrence/get-project-recurring-task-ids";

const toSet = (result: { taskIds: string[] }) => new Set(result.taskIds);

// One request per project; every card on the board shares it.
function useProjectRecurringTaskIds(projectId: string) {
  const { data } = useQuery({
    queryKey: ["task-recurrence", "project", projectId],
    queryFn: () => getProjectRecurringTaskIds(projectId),
    enabled: !!projectId,
    staleTime: 60_000,
    select: toSet,
  });
  return data;
}

export default useProjectRecurringTaskIds;
