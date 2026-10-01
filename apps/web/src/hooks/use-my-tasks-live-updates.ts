import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { myTasksKey } from "@/hooks/queries/my-tasks/use-my-tasks";
import { getWsUrl } from "@/hooks/use-project-websocket";

const REFRESH_DELAY_MS = 300;

// Listens to every project's board socket. The server never echoes a change
// back to the tab that made it, so this tab's own successful saves (including
// edits in the task panel) trigger the refresh too.
export function useMyTasksLiveUpdates(
  workspaceId: string,
  projectIds: string[],
) {
  const queryClient = useQueryClient();
  const projectKey = projectIds.join(",");

  useEffect(() => {
    if (!workspaceId) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void queryClient.invalidateQueries({
          queryKey: myTasksKey(workspaceId),
        });
      }, REFRESH_DELAY_MS);
    };

    const sockets = projectKey
      ? projectKey.split(",").map((projectId) => {
          const socket = new WebSocket(getWsUrl(projectId));
          socket.onmessage = (event) => {
            try {
              const message = JSON.parse(String(event.data)) as {
                type?: unknown;
              };
              if (
                typeof message.type === "string" &&
                (message.type.startsWith("TASK") ||
                  message.type === "PROJECT_UPDATED")
              ) {
                refresh();
              }
            } catch {
              // Not a JSON frame; nothing to do.
            }
          };
          return socket;
        })
      : [];

    const unsubscribe = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success") {
        refresh();
      }
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
      for (const socket of sockets) socket.close();
    };
  }, [queryClient, workspaceId, projectKey]);
}
