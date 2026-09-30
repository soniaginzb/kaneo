import { subscribeToEvent } from "../events";
import { spawnNextOccurrence } from "./spawn-next-occurrence";

subscribeToEvent<{ taskId: string; userId?: string }>(
  "task.status_changed",
  async (data) => {
    await spawnNextOccurrence({ taskId: data.taskId, userId: data.userId });
  },
);
