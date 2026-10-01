import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { myTasksKey } from "@/hooks/queries/my-tasks/use-my-tasks";
import { getWsUrl } from "@/hooks/use-project-websocket";

const REFRESH_DELAY_MS = 300;
const PING_INTERVAL_MS = 30_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const SOCKET_OPEN = 1;

// Listens to every project's board socket. The server never echoes a change
// back to the tab that made it, so this tab's own successful saves (including
// edits in the task panel) trigger the refresh too. Sockets drop on sleep or
// network changes, so each one reconnects and refreshes once it is back.
export function useMyTasksLiveUpdates(
  workspaceId: string,
  projectIds: string[],
) {
  const queryClient = useQueryClient();
  const projectKey = projectIds.join(",");

  useEffect(() => {
    if (!workspaceId) return;

    let disposed = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        // This page's own pending save refetches when it settles; refetching
        // now would undo its on-screen update.
        if (queryClient.isMutating({ mutationKey: myTasksKey(workspaceId) })) {
          return;
        }
        void queryClient.invalidateQueries({
          queryKey: myTasksKey(workspaceId),
        });
      }, REFRESH_DELAY_MS);
    };

    const sockets = new Set<WebSocket>();
    const reconnectTimers = new Set<ReturnType<typeof setTimeout>>();

    const connect = (projectId: string, attempt: number) => {
      // Failed attempts so far; an open socket starts the backoff over.
      let failures = attempt;
      const socket = new WebSocket(getWsUrl(projectId));
      sockets.add(socket);
      socket.onopen = () => {
        // Events may have been missed while the socket was down.
        if (failures > 0) refresh();
        failures = 0;
      };
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
      socket.onclose = () => {
        sockets.delete(socket);
        if (disposed) return;
        const delay = Math.min(1000 * 2 ** failures, MAX_RECONNECT_DELAY_MS);
        const timer = setTimeout(() => {
          reconnectTimers.delete(timer);
          if (!disposed) connect(projectId, failures + 1);
        }, delay);
        reconnectTimers.add(timer);
      };
    };

    if (projectKey) {
      for (const projectId of projectKey.split(",")) connect(projectId, 0);
    }

    // Keeps idle connections open through proxies that drop quiet sockets.
    const pingTimer = setInterval(() => {
      for (const socket of sockets) {
        if (socket.readyState === SOCKET_OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
        }
      }
    }, PING_INTERVAL_MS);

    const unsubscribe = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success") {
        refresh();
      }
    });

    return () => {
      disposed = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      for (const timer of reconnectTimers) clearTimeout(timer);
      clearInterval(pingTimer);
      unsubscribe();
      for (const socket of sockets) socket.close();
    };
  }, [queryClient, workspaceId, projectKey]);
}
