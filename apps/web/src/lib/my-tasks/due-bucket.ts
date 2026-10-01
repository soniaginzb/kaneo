import { addWeeks, startOfDay, startOfWeek } from "date-fns";
import type { WeekStartDay } from "@/store/user-preferences";

export const DUE_BUCKETS = [
  "overdue",
  "today",
  "thisWeek",
  "nextWeek",
  "later",
  "noDate",
] as const;
export type DueBucket = (typeof DUE_BUCKETS)[number];

// Compares local calendar days: due dates are saved as local midnight, so a
// task due today must never read as overdue in time zones east of UTC.
export function dueBucket(
  dueDate: string | null,
  now: Date,
  weekStartsOn: WeekStartDay,
): DueBucket {
  if (!dueDate) return "noDate";
  const due = startOfDay(new Date(dueDate));
  const today = startOfDay(now);
  if (due < today) return "overdue";
  if (due.getTime() === today.getTime()) return "today";
  const nextWeekStart = addWeeks(startOfWeek(today, { weekStartsOn }), 1);
  if (due < nextWeekStart) return "thisWeek";
  if (due < addWeeks(nextWeekStart, 1)) return "nextWeek";
  return "later";
}
