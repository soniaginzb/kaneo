import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import getMyTasks from "./controllers/get-my-tasks";
import { myTasksSchema } from "./response";
import { myTasksQuery, workspaceIdParam } from "./schema";

const getMyTasksRoute = createRoute({
  method: "get",
  operationId: "getMyTasks",
  path: "/{workspaceId}",
  tags: ["My Tasks"],
  summary: "List my tasks",
  description:
    "Tasks in the workspace's active projects that are assigned to the caller or unassigned, with each project's columns. Archived tasks are left out.",
  middleware: [workspaceAccess.fromParam("workspaceId")] as const,
  request: { params: workspaceIdParam, query: myTasksQuery },
  responses: {
    200: jsonResponse("The caller's tasks", myTasksSchema),
    403: errorResponse("Not a member of the workspace"),
  },
});

const myTasks = apiRouter<BaseVariables & { workspaceId: string }>().openapi(
  getMyTasksRoute,
  async (c) => {
    const { workspaceId } = c.req.valid("param");
    const { completed } = c.req.valid("query");
    return c.json(
      await getMyTasks({ workspaceId, userId: c.get("userId"), completed }),
      200,
    );
  },
);

export default myTasks;
