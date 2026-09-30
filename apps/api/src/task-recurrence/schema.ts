import { z } from "../openapi";

export const taskIdParam = z.object({ taskId: z.string() });

export const projectIdParam = z.object({ projectId: z.string() });

export const setTaskRecurrenceBody = z.object({
  rrule: z.string().min(1).max(200).openapi({
    description:
      "RFC 5545 RRULE body, e.g. FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TH. Supported: DAILY; WEEKLY with BYDAY; MONTHLY with BYMONTHDAY (1-31 or -1) or one ordinal BYDAY (1MO-4SU, -1FR); YEARLY with BYMONTH and BYMONTHDAY; INTERVAL 1-365. Days past a month's end clamp to its last day.",
  }),
  timeZone: z.string().min(1).max(64).openapi({
    description: "IANA time zone the rule is evaluated in, e.g. Europe/London.",
  }),
});
