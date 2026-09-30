import { eq } from "drizzle-orm";
import db from "../../database";
import { taskRecurrenceTable, taskTable } from "../../database/schema";

async function getProjectRecurringTaskIds(projectId: string) {
  const rows = await db
    .select({ taskId: taskRecurrenceTable.taskId })
    .from(taskRecurrenceTable)
    .innerJoin(taskTable, eq(taskTable.id, taskRecurrenceTable.taskId))
    .where(eq(taskTable.projectId, projectId));
  return { taskIds: rows.map((row) => row.taskId) };
}

export default getProjectRecurringTaskIds;
