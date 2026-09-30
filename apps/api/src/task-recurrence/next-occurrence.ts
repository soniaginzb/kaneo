import {
  addDays,
  type CalendarDate,
  clampedDay,
  compareDates,
  fromMonthIndex,
  monthIndex,
  nthWeekdayOfMonth,
  startOfWeek,
  toDayNumber,
  weekdayOf,
} from "./calendar";
import type { RecurrenceRule } from "./rule";
import { fromWallClock, toWallClock } from "./zoned-time";

// Earliest date in the series strictly after `after`. The series is anchored at
// `anchor` so intervals above 1 keep their rhythm while catching up.
function nextInSeries(
  rule: RecurrenceRule,
  anchor: CalendarDate,
  after: CalendarDate,
): CalendarDate {
  switch (rule.freq) {
    case "DAILY": {
      const elapsed = toDayNumber(after) - toDayNumber(anchor);
      return addDays(
        anchor,
        (Math.floor(elapsed / rule.interval) + 1) * rule.interval,
      );
    }
    case "WEEKLY": {
      const anchorWeek = toDayNumber(startOfWeek(anchor));
      for (let offset = 1; offset <= 14 * rule.interval; offset++) {
        const candidate = addDays(after, offset);
        const weeks = (toDayNumber(startOfWeek(candidate)) - anchorWeek) / 7;
        if (
          weeks % rule.interval === 0 &&
          rule.byDay.includes(weekdayOf(candidate))
        ) {
          return candidate;
        }
      }
      throw new Error("Weekly rule produced no occurrence");
    }
    case "MONTHLY": {
      const anchorMonth = monthIndex(anchor);
      let step = Math.floor((monthIndex(after) - anchorMonth) / rule.interval);
      for (;;) {
        const { year, month } = fromMonthIndex(
          anchorMonth + step * rule.interval,
        );
        const candidate =
          "byMonthDay" in rule
            ? clampedDay(year, month, rule.byMonthDay)
            : nthWeekdayOfMonth(
                year,
                month,
                rule.byWeekday.ordinal,
                rule.byWeekday.weekday,
              );
        if (compareDates(candidate, after) > 0) return candidate;
        step++;
      }
    }
    case "YEARLY": {
      let step = Math.floor((after.year - anchor.year) / rule.interval);
      for (;;) {
        const candidate = clampedDay(
          anchor.year + step * rule.interval,
          rule.byMonth,
          rule.byMonthDay,
        );
        if (compareDates(candidate, after) > 0) return candidate;
        step++;
      }
    }
  }
}

export function nextDueDate({
  rule,
  timeZone,
  previousDue,
  completedAt,
  now,
}: {
  rule: RecurrenceRule;
  timeZone: string;
  previousDue: Date | null;
  completedAt: Date;
  now: Date;
}) {
  // Due dates are saved as the browser's local midnight, so rules are
  // evaluated on local calendar dates rather than UTC ones.
  const anchorClock = previousDue
    ? toWallClock(previousDue, timeZone)
    : {
        ...toWallClock(completedAt, timeZone),
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      };
  const anchor = {
    year: anchorClock.year,
    month: anchorClock.month,
    day: anchorClock.day,
  };
  const nowClock = toWallClock(now, timeZone);
  const today = {
    year: nowClock.year,
    month: nowClock.month,
    day: nowClock.day,
  };

  let next = nextInSeries(rule, anchor, anchor);
  // A late completion yields one current copy, not a backlog of overdue ones.
  while (compareDates(next, today) < 0) next = nextInSeries(rule, anchor, next);

  return fromWallClock(
    {
      ...next,
      hour: anchorClock.hour,
      minute: anchorClock.minute,
      second: anchorClock.second,
      millisecond: anchorClock.millisecond,
    },
    timeZone,
  );
}
