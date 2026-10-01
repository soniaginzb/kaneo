import { eventContext, subscribeToEvent } from "../events";
import { spawnNextOccurrence } from "./spawn-next-occurrence";

subscribeToEvent<{ taskId: string; userId?: string }>(
  "task.status_changed",
  async (data) => {
    // The handler inherits the completing tab's event context, and websocket
    // broadcasts skip that tab. That tab did not create the copies, so leave
    // the context to announce them to every board, including its own.
    await eventContext.exit(() =>
      spawnNextOccurrence({ taskId: data.taskId, userId: data.userId }),
    );
  },
);
