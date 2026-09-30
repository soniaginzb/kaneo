import { describe, expect, it } from "vite-plus/test";
import {
  fromWallClock,
  isValidTimeZone,
  toWallClock,
} from "../../../apps/api/src/task-recurrence/zoned-time";

const midnight = { hour: 0, minute: 0, second: 0, millisecond: 0 };

describe("zoned time", () => {
  it("reads wall-clock time east of UTC", () => {
    expect(
      toWallClock(new Date("2026-10-05T18:30:00Z"), "Asia/Kolkata"),
    ).toEqual({ year: 2026, month: 10, day: 6, ...midnight });
  });

  it("converts local midnight back to UTC on both sides of a DST change", () => {
    expect(
      fromWallClock(
        { year: 2026, month: 3, day: 8, ...midnight },
        "America/Los_Angeles",
      ).toISOString(),
    ).toBe("2026-03-08T08:00:00.000Z");
    expect(
      fromWallClock(
        { year: 2026, month: 3, day: 9, ...midnight },
        "America/Los_Angeles",
      ).toISOString(),
    ).toBe("2026-03-09T07:00:00.000Z");
  });

  it("keeps UTC unchanged", () => {
    expect(
      fromWallClock(
        {
          year: 2026,
          month: 10,
          day: 5,
          hour: 17,
          minute: 0,
          second: 0,
          millisecond: 0,
        },
        "UTC",
      ).toISOString(),
    ).toBe("2026-10-05T17:00:00.000Z");
  });

  it("validates IANA zone names", () => {
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
  });
});
