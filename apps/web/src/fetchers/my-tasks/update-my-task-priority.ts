import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

type PriorityValue = InferRequestType<
  (typeof client)["task"]["priority"][":id"]["$put"]
>["json"]["priority"];

async function updateMyTaskPriority(taskId: string, priority: string) {
  const response = await client.task.priority[":id"].$put({
    param: { id: taskId },
    json: { priority: priority as PriorityValue },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default updateMyTaskPriority;
