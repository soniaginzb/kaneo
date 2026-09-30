import { z } from "../openapi";

export const taskRecurrenceSchema = z
  .object({
    taskId: z.string(),
    rrule: z.string(),
    timeZone: z.string(),
    nextDueDate: z.string().openapi({
      format: "date-time",
      description:
        "When the next copy would be due if the task were completed now.",
    }),
  })
  .openapi("TaskRecurrence");

export const taskRecurrenceResultSchema = z
  .object({ recurrence: taskRecurrenceSchema.nullable() })
  .openapi("TaskRecurrenceResult");

export const deletedTaskRecurrenceSchema = z
  .object({ deleted: z.boolean() })
  .openapi("DeletedTaskRecurrence");

export const recurringTaskIdsSchema = z
  .object({ taskIds: z.array(z.string()) })
  .openapi("RecurringTaskIds");
