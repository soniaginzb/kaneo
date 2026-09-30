import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function getTaskRecurrence(taskId: string) {
  const response = await client["task-recurrence"][":taskId"].$get({
    param: { taskId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default getTaskRecurrence;
