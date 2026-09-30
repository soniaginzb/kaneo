import { describe, expect, it } from "vite-plus/test";
import {
  addDays,
  clampedDay,
  compareDates,
  daysInMonth,
  fromMonthIndex,
  monthIndex,
  nthWeekdayOfMonth,
  startOfWeek,
  weekdayOf,
} from "../../../apps/api/src/task-recurrence/calendar";

describe("calendar", () => {
  it("knows month lengths including leap years", () => {
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2027, 2)).toBe(28);
    expect(daysInMonth(2026, 11)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it("finds weekdays with Monday first", () => {
    expect(weekdayOf({ year: 2026, month: 10, day: 5 })).toBe("MO");
    expect(weekdayOf({ year: 2026, month: 10, day: 8 })).toBe("TH");
    expect(weekdayOf({ year: 2026, month: 3, day: 8 })).toBe("SU");
  });

  it("adds days across month and year ends", () => {
    expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({
      year: 2027,
      month: 1,
      day: 1,
    });
    expect(addDays({ year: 2026, month: 3, day: 1 }, -1)).toEqual({
      year: 2026,
      month: 2,
      day: 28,
    });
  });

  it("compares dates", () => {
    expect(
      compareDates(
        { year: 2026, month: 10, day: 5 },
        { year: 2026, month: 10, day: 6 },
      ),
    ).toBeLessThan(0);
    expect(
      compareDates(
        { year: 2026, month: 10, day: 5 },
        { year: 2026, month: 10, day: 5 },
      ),
    ).toBe(0);
  });

  it("finds the Monday that starts a week", () => {
    expect(startOfWeek({ year: 2026, month: 10, day: 8 })).toEqual({
      year: 2026,
      month: 10,
      day: 5,
    });
    expect(startOfWeek({ year: 2026, month: 10, day: 5 })).toEqual({
      year: 2026,
      month: 10,
      day: 5,
    });
  });

  it("round-trips month indexes", () => {
    expect(fromMonthIndex(monthIndex({ year: 2026, month: 12 }) + 1)).toEqual({
      year: 2027,
      month: 1,
    });
  });

  it("clamps days past the end of the month", () => {
    expect(clampedDay(2026, 11, 31)).toEqual({
      year: 2026,
      month: 11,
      day: 30,
    });
    expect(clampedDay(2027, 2, -1)).toEqual({ year: 2027, month: 2, day: 28 });
    expect(clampedDay(2026, 10, 15)).toEqual({
      year: 2026,
      month: 10,
      day: 15,
    });
  });

  it("finds the nth and last weekday of a month", () => {
    expect(nthWeekdayOfMonth(2026, 11, 1, "MO")).toEqual({
      year: 2026,
      month: 11,
      day: 2,
    });
    expect(nthWeekdayOfMonth(2026, 11, -1, "FR")).toEqual({
      year: 2026,
      month: 11,
      day: 27,
    });
    expect(nthWeekdayOfMonth(2026, 10, -1, "FR")).toEqual({
      year: 2026,
      month: 10,
      day: 30,
    });
    expect(nthWeekdayOfMonth(2026, 10, 4, "TH")).toEqual({
      year: 2026,
      month: 10,
      day: 22,
    });
  });
});
