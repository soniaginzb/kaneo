import { describe, expect, it } from "vite-plus/test";
import { dueBucket } from "./due-bucket";

// Due dates are saved as local midnight, so build them from local calendar dates.
const local = (month: number, day: number, hour = 0, minute = 0) =>
  new Date(2026, month - 1, day, hour, minute).toISOString();
const NOW = new Date(2026, 9, 7, 10, 0); // Wednesday 7 October 2026, 10:00 local

describe("dueBucket", () => {
  it("puts tasks without a due date in No date", () => {
    expect(dueBucket(null, NOW, 1)).toBe("noDate");
  });

  it("treats any time today as Today, and yesterday as Overdue", () => {
    expect(dueBucket(local(10, 7), NOW, 1)).toBe("today");
    expect(dueBucket(local(10, 7, 23, 30), NOW, 1)).toBe("today");
    expect(dueBucket(local(10, 6, 23, 59), NOW, 1)).toBe("overdue");
  });

  it("splits this week, next week and later with Monday starts", () => {
    expect(dueBucket(local(10, 8), NOW, 1)).toBe("thisWeek");
    expect(dueBucket(local(10, 11), NOW, 1)).toBe("thisWeek");
    expect(dueBucket(local(10, 12), NOW, 1)).toBe("nextWeek");
    expect(dueBucket(local(10, 18), NOW, 1)).toBe("nextWeek");
    expect(dueBucket(local(10, 19), NOW, 1)).toBe("later");
  });

  it("follows a Sunday week start", () => {
    expect(dueBucket(local(10, 10), NOW, 0)).toBe("thisWeek");
    expect(dueBucket(local(10, 11), NOW, 0)).toBe("nextWeek");
    expect(dueBucket(local(10, 17), NOW, 0)).toBe("nextWeek");
    expect(dueBucket(local(10, 18), NOW, 0)).toBe("later");
  });

  it("follows a Saturday week start", () => {
    expect(dueBucket(local(10, 9), NOW, 6)).toBe("thisWeek");
    expect(dueBucket(local(10, 10), NOW, 6)).toBe("nextWeek");
    expect(dueBucket(local(10, 16), NOW, 6)).toBe("nextWeek");
    expect(dueBucket(local(10, 17), NOW, 6)).toBe("later");
  });
});
