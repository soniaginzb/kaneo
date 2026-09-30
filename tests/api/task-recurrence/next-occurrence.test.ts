import { describe, expect, it } from "vite-plus/test";
import { nextDueDate } from "../../../apps/api/src/task-recurrence/next-occurrence";
import { parseRule } from "../../../apps/api/src/task-recurrence/rule";

function next(
  rrule: string,
  previousDue: string | null,
  now: string,
  timeZone = "UTC",
) {
  return nextDueDate({
    rule: parseRule(rrule),
    timeZone,
    previousDue: previousDue ? new Date(previousDue) : null,
    completedAt: new Date(now),
    now: new Date(now),
  }).toISOString();
}

describe("nextDueDate", () => {
  it("steps daily patterns", () => {
    expect(
      next("FREQ=DAILY", "2026-10-05T00:00:00Z", "2026-10-05T12:00:00Z"),
    ).toBe("2026-10-06T00:00:00.000Z");
    expect(
      next(
        "FREQ=DAILY;INTERVAL=3",
        "2026-10-05T00:00:00Z",
        "2026-10-05T12:00:00Z",
      ),
    ).toBe("2026-10-08T00:00:00.000Z");
  });

  it("keeps the time of day of the previous due date", () => {
    expect(
      next("FREQ=DAILY", "2026-10-05T17:00:00Z", "2026-10-05T12:00:00Z"),
    ).toBe("2026-10-06T17:00:00.000Z");
  });

  it("walks chosen weekdays", () => {
    expect(
      next(
        "FREQ=WEEKLY;BYDAY=MO,TH",
        "2026-10-05T00:00:00Z",
        "2026-10-05T12:00:00Z",
      ),
    ).toBe("2026-10-08T00:00:00.000Z");
    expect(
      next(
        "FREQ=WEEKLY;BYDAY=MO,TH",
        "2026-10-08T00:00:00Z",
        "2026-10-08T12:00:00Z",
      ),
    ).toBe("2026-10-12T00:00:00.000Z");
  });

  it("skips off-weeks for fortnightly patterns", () => {
    expect(
      next(
        "FREQ=WEEKLY;INTERVAL=2;BYDAY=FR",
        "2026-10-02T00:00:00Z",
        "2026-10-02T12:00:00Z",
      ),
    ).toBe("2026-10-16T00:00:00.000Z");
    expect(
      next(
        "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH",
        "2026-10-08T00:00:00Z",
        "2026-10-08T12:00:00Z",
      ),
    ).toBe("2026-10-19T00:00:00.000Z");
  });

  it("clamps monthly days to short months without drifting", () => {
    expect(
      next(
        "FREQ=MONTHLY;BYMONTHDAY=31",
        "2026-10-31T00:00:00Z",
        "2026-10-31T12:00:00Z",
      ),
    ).toBe("2026-11-30T00:00:00.000Z");
    expect(
      next(
        "FREQ=MONTHLY;BYMONTHDAY=31",
        "2026-11-30T00:00:00Z",
        "2026-11-30T12:00:00Z",
      ),
    ).toBe("2026-12-31T00:00:00.000Z");
    expect(
      next(
        "FREQ=MONTHLY;BYMONTHDAY=-1",
        "2027-01-31T00:00:00Z",
        "2027-01-31T12:00:00Z",
      ),
    ).toBe("2027-02-28T00:00:00.000Z");
  });

  it("finds nth and last weekdays of the month", () => {
    expect(
      next(
        "FREQ=MONTHLY;BYDAY=-1FR",
        "2026-10-30T00:00:00Z",
        "2026-10-30T12:00:00Z",
      ),
    ).toBe("2026-11-27T00:00:00.000Z");
    expect(
      next(
        "FREQ=MONTHLY;BYDAY=1MO",
        "2026-10-05T00:00:00Z",
        "2026-10-05T12:00:00Z",
      ),
    ).toBe("2026-11-02T00:00:00.000Z");
  });

  it("honours monthly intervals", () => {
    expect(
      next(
        "FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=15",
        "2026-10-15T00:00:00Z",
        "2026-10-15T12:00:00Z",
      ),
    ).toBe("2027-01-15T00:00:00.000Z");
  });

  it("handles 29 February yearly", () => {
    expect(
      next(
        "FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29",
        "2028-02-29T00:00:00Z",
        "2028-02-29T12:00:00Z",
      ),
    ).toBe("2029-02-28T00:00:00.000Z");
    expect(
      next(
        "FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29",
        "2031-02-28T00:00:00Z",
        "2031-02-28T12:00:00Z",
      ),
    ).toBe("2032-02-29T00:00:00.000Z");
  });

  it("catches up past occurrences instead of scheduling them", () => {
    expect(
      next("FREQ=DAILY", "2026-09-01T00:00:00Z", "2026-10-05T15:00:00Z"),
    ).toBe("2026-10-05T00:00:00.000Z");
    expect(
      next(
        "FREQ=WEEKLY;INTERVAL=2;BYDAY=FR",
        "2026-10-02T00:00:00Z",
        "2026-10-20T09:00:00Z",
      ),
    ).toBe("2026-10-30T00:00:00.000Z");
  });

  it("counts from local midnight of the completion date when there was no due date", () => {
    expect(next("FREQ=DAILY", null, "2026-10-05T15:30:00Z")).toBe(
      "2026-10-06T00:00:00.000Z",
    );
    expect(
      next("FREQ=DAILY", null, "2026-10-05T20:00:00Z", "Asia/Kolkata"),
    ).toBe("2026-10-06T18:30:00.000Z");
  });

  it("keeps the weekday for local-midnight due dates east of UTC", () => {
    // Monday 5 Oct 00:00 in Kolkata is Sunday 18:30 UTC.
    expect(
      next(
        "FREQ=WEEKLY;BYDAY=MO",
        "2026-10-04T18:30:00Z",
        "2026-10-05T10:00:00Z",
        "Asia/Kolkata",
      ),
    ).toBe("2026-10-11T18:30:00.000Z");
  });

  it("follows daylight saving changes west of UTC", () => {
    expect(
      next(
        "FREQ=DAILY",
        "2026-03-08T08:00:00Z",
        "2026-03-08T20:00:00Z",
        "America/Los_Angeles",
      ),
    ).toBe("2026-03-09T07:00:00.000Z");
  });
});
