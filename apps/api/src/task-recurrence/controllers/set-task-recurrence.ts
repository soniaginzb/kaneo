import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskRecurrenceTable, taskTable } from "../../database/schema";
import { describeRecurrence } from "../describe-recurrence";
import { formatRule, parseRule, RecurrenceRuleError } from "../rule";
import { isValidTimeZone } from "../zoned-time";

function canonicalRule(rrule: string) {
  try {
    return formatRule(parseRule(rrule));
  } catch (error) {
    if (error instanceof RecurrenceRuleError) {
      throw new HTTPException(400, { message: error.message });
    }
    throw error;
  }
}

async function setTaskRecurrence({
  taskId,
  rrule,
  timeZone,
}: {
  taskId: string;
  rrule: string;
  timeZone: string;
}) {
  const canonical = canonicalRule(rrule);
  if (!isValidTimeZone(timeZone)) {
    throw new HTTPException(400, {
      message: `Unknown time zone "${timeZone}"`,
    });
  }

  const task = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, taskId),
    columns: { dueDate: true },
  });
  if (!task) throw new HTTPException(404, { message: "Task not found" });

  await db
    .insert(taskRecurrenceTable)
    .values({ taskId, rrule: canonical, timeZone })
    .onConflictDoUpdate({
      target: taskRecurrenceTable.taskId,
      set: { rrule: canonical, timeZone, updatedAt: new Date() },
    });

  return describeRecurrence({
    taskId,
    rrule: canonical,
    timeZone,
    dueDate: task.dueDate,
  });
}

export default setTaskRecurrence;
