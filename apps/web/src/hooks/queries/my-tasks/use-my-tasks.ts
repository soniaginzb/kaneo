import { keepPreviousData, useQuery } from "@tanstack/react-query";
import getMyTasks from "@/fetchers/my-tasks/get-my-tasks";
import type { CompletedWindow } from "@/lib/my-tasks/types";

export function myTasksKey(workspaceId: string) {
  return ["my-tasks", workspaceId] as const;
}

function useMyTasks(workspaceId: string, completed: CompletedWindow) {
  return useQuery({
    queryKey: [...myTasksKey(workspaceId), completed],
    queryFn: () => getMyTasks(workspaceId, completed),
    enabled: !!workspaceId,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
  });
}

export default useMyTasks;
