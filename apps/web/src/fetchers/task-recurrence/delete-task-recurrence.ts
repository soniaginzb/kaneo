import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function deleteTaskRecurrence(taskId: string) {
  const response = await client["task-recurrence"][":taskId"].$delete({
    param: { taskId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default deleteTaskRecurrence;
