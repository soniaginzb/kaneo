import { eq } from "drizzle-orm";
import db from "../../database";
import { taskRecurrenceTable } from "../../database/schema";

async function deleteTaskRecurrence(taskId: string) {
  const deleted = await db
    .delete(taskRecurrenceTable)
    .where(eq(taskRecurrenceTable.taskId, taskId))
    .returning({ id: taskRecurrenceTable.id });
  return { deleted: deleted.length > 0 };
}

export default deleteTaskRecurrence;
