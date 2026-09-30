import { requireEntitlement } from "../billing/require-entitlement-middleware";
import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import deleteTaskRecurrence from "./controllers/delete-task-recurrence";
import getProjectRecurringTaskIds from "./controllers/get-project-recurring-task-ids";
import getTaskRecurrence from "./controllers/get-task-recurrence";
import setTaskRecurrence from "./controllers/set-task-recurrence";
import {
  deletedTaskRecurrenceSchema,
  recurringTaskIdsSchema,
  taskRecurrenceResultSchema,
  taskRecurrenceSchema,
} from "./response";
import { projectIdParam, setTaskRecurrenceBody, taskIdParam } from "./schema";
import "./subscriber";

const getTaskRecurrenceRoute = createRoute({
  method: "get",
  operationId: "getTaskRecurrence",
  path: "/{taskId}",
  tags: ["Task Recurrence"],
  summary: "Get task recurrence",
  description:
    "Get the task's repeat rule and the next due date it would produce, or null if the task does not repeat.",
  middleware: [workspaceAccess.fromTaskId("taskId")] as const,
  request: { params: taskIdParam },
  responses: {
    200: jsonResponse("The task's repeat rule", taskRecurrenceResultSchema),
    403: errorResponse("No access to the task's workspace"),
  },
});

const setTaskRecurrenceRoute = createRoute({
  method: "put",
  operationId: "setTaskRecurrence",
  path: "/{taskId}",
  tags: ["Task Recurrence"],
  summary: "Set task recurrence",
  description:
    "Create or replace the task's repeat rule. When the task is completed, a copy with the next due date is created and the rule moves to it.",
  middleware: [
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["update"] }),
    requireEntitlement,
  ] as const,
  request: {
    params: taskIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: setTaskRecurrenceBody } },
    },
  },
  responses: {
    200: jsonResponse("The saved repeat rule", taskRecurrenceSchema),
    400: errorResponse("Unsupported rule or unknown time zone"),
    403: errorResponse(
      "No workspace access, or missing task:update permission",
    ),
    404: errorResponse("Task not found"),
  },
});

const deleteTaskRecurrenceRoute = createRoute({
  method: "delete",
  operationId: "deleteTaskRecurrence",
  path: "/{taskId}",
  tags: ["Task Recurrence"],
  summary: "Stop task recurrence",
  description: "Remove the task's repeat rule. The task itself is unchanged.",
  middleware: [
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["update"] }),
    requireEntitlement,
  ] as const,
  request: { params: taskIdParam },
  responses: {
    200: jsonResponse(
      "Whether a rule was removed",
      deletedTaskRecurrenceSchema,
    ),
    403: errorResponse(
      "No workspace access, or missing task:update permission",
    ),
  },
});

const getProjectRecurringTaskIdsRoute = createRoute({
  method: "get",
  operationId: "getProjectRecurringTaskIds",
  path: "/project/{projectId}",
  tags: ["Task Recurrence"],
  summary: "List recurring tasks in a project",
  description:
    "IDs of the project's tasks that have a repeat rule, for board indicators.",
  middleware: [workspaceAccess.fromProjectId("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("Recurring task IDs", recurringTaskIdsSchema),
    403: errorResponse("No access to the project's workspace"),
  },
});

const taskRecurrence = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(getTaskRecurrenceRoute, async (c) =>
    c.json(await getTaskRecurrence(c.req.valid("param").taskId), 200),
  )
  .openapi(setTaskRecurrenceRoute, async (c) => {
    const { taskId } = c.req.valid("param");
    const { rrule, timeZone } = c.req.valid("json");
    return c.json(await setTaskRecurrence({ taskId, rrule, timeZone }), 200);
  })
  .openapi(deleteTaskRecurrenceRoute, async (c) =>
    c.json(await deleteTaskRecurrence(c.req.valid("param").taskId), 200),
  )
  .openapi(getProjectRecurringTaskIdsRoute, async (c) =>
    c.json(
      await getProjectRecurringTaskIds(c.req.valid("param").projectId),
      200,
    ),
  );

export default taskRecurrence;
