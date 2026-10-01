import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { CompletedWindow, MyTasksData } from "@/lib/my-tasks/types";

async function getMyTasks(
  workspaceId: string,
  completed: CompletedWindow,
): Promise<MyTasksData> {
  const response = await client["my-tasks"][":workspaceId"].$get({
    param: { workspaceId },
    query: { completed },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data: MyTasksData = await response.json();
  return data;
}

export default getMyTasks;
