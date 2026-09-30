import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function getProjectRecurringTaskIds(projectId: string) {
  const response = await client["task-recurrence"].project[":projectId"].$get({
    param: { projectId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default getProjectRecurringTaskIds;
