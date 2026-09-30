import { eq } from "drizzle-orm";
import db from "../../database";
import { taskRecurrenceTable, taskTable } from "../../database/schema";
import { describeRecurrence } from "../describe-recurrence";

async function getTaskRecurrence(taskId: string) {
  const [row] = await db
    .select({
      rrule: taskRecurrenceTable.rrule,
      timeZone: taskRecurrenceTable.timeZone,
      dueDate: taskTable.dueDate,
    })
    .from(taskRecurrenceTable)
    .innerJoin(taskTable, eq(taskTable.id, taskRecurrenceTable.taskId))
    .where(eq(taskRecurrenceTable.taskId, taskId))
    .limit(1);

  return { recurrence: row ? describeRecurrence({ taskId, ...row }) : null };
}

export default getTaskRecurrence;
