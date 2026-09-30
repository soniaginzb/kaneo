import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function setTaskRecurrence(
  taskId: string,
  body: { rrule: string; timeZone: string },
) {
  const response = await client["task-recurrence"][":taskId"].$put({
    param: { taskId },
    json: body,
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default setTaskRecurrence;
