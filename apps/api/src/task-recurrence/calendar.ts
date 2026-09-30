export type Weekday = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";
export type WeekdayOrdinal = 1 | 2 | 3 | 4 | -1;

export const WEEKDAYS: readonly Weekday[] = [
  "MO",
  "TU",
  "WE",
  "TH",
  "FR",
  "SA",
  "SU",
];

export type CalendarDate = { year: number; month: number; day: number };

const DAY_MS = 86_400_000;

export function toDayNumber(date: CalendarDate) {
  return Math.round(Date.UTC(date.year, date.month - 1, date.day) / DAY_MS);
}

function fromDayNumber(dayNumber: number): CalendarDate {
  const date = new Date(dayNumber * DAY_MS);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function addDays(date: CalendarDate, days: number) {
  return fromDayNumber(toDayNumber(date) + days);
}

export function compareDates(a: CalendarDate, b: CalendarDate) {
  return toDayNumber(a) - toDayNumber(b);
}

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function weekdayOf(date: CalendarDate): Weekday {
  // getUTCDay counts from Sunday; WEEKDAYS starts on Monday.
  const sundayFirst = new Date(toDayNumber(date) * DAY_MS).getUTCDay();
  return WEEKDAYS[(sundayFirst + 6) % 7] as Weekday;
}

export function startOfWeek(date: CalendarDate) {
  return addDays(date, -WEEKDAYS.indexOf(weekdayOf(date)));
}

export function monthIndex(date: { year: number; month: number }) {
  return date.year * 12 + (date.month - 1);
}

export function fromMonthIndex(index: number) {
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

// Day -1 means the month's last day. Days past the end clamp to it, so
// "the 31st" lands on 30 November rather than skipping the month.
export function clampedDay(
  year: number,
  month: number,
  day: number,
): CalendarDate {
  const last = daysInMonth(year, month);
  return { year, month, day: day === -1 ? last : Math.min(day, last) };
}

export function nthWeekdayOfMonth(
  year: number,
  month: number,
  ordinal: WeekdayOrdinal,
  weekday: Weekday,
): CalendarDate {
  const target = WEEKDAYS.indexOf(weekday);
  if (ordinal === -1) {
    const lastDay = daysInMonth(year, month);
    const lastWeekday = WEEKDAYS.indexOf(
      weekdayOf({ year, month, day: lastDay }),
    );
    return { year, month, day: lastDay - ((lastWeekday - target + 7) % 7) };
  }
  const firstWeekday = WEEKDAYS.indexOf(weekdayOf({ year, month, day: 1 }));
  return {
    year,
    month,
    day: 1 + ((target - firstWeekday + 7) % 7) + 7 * (ordinal - 1),
  };
}
