import { nextDueDate } from "./next-occurrence";
import { parseRule } from "./rule";

export function describeRecurrence(
  recurrence: {
    taskId: string;
    rrule: string;
    timeZone: string;
    dueDate: Date | null;
  },
  now = new Date(),
) {
  return {
    taskId: recurrence.taskId,
    rrule: recurrence.rrule,
    timeZone: recurrence.timeZone,
    nextDueDate: nextDueDate({
      rule: parseRule(recurrence.rrule),
      timeZone: recurrence.timeZone,
      previousDue: recurrence.dueDate,
      completedAt: now,
      now,
    }).toISOString(),
  };
}
