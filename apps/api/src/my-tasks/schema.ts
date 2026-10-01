import { z } from "../openapi";
import { COMPLETED_WINDOWS } from "./controllers/get-my-tasks";

export const workspaceIdParam = z.object({ workspaceId: z.string() });

export const myTasksQuery = z.object({
  completed: z.enum(COMPLETED_WINDOWS).default("hide").openapi({
    description:
      "Which completed tasks to include: hide (none), 7d / 30d (completed in the last 7 or 30 days), or all.",
  }),
});
