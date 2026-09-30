import { describe, expect, it } from "vite-plus/test";
import {
  formatRule,
  parseRule,
  RecurrenceRuleError,
} from "../../../apps/api/src/task-recurrence/rule";

describe("parseRule", () => {
  it("parses each supported pattern", () => {
    expect(parseRule("FREQ=DAILY")).toEqual({ freq: "DAILY", interval: 1 });
    expect(parseRule("FREQ=DAILY;INTERVAL=3")).toEqual({
      freq: "DAILY",
      interval: 3,
    });
    expect(parseRule("FREQ=WEEKLY;BYDAY=TH,MO")).toEqual({
      freq: "WEEKLY",
      interval: 1,
      byDay: ["MO", "TH"],
    });
    expect(parseRule("FREQ=MONTHLY;BYMONTHDAY=31")).toEqual({
      freq: "MONTHLY",
      interval: 1,
      byMonthDay: 31,
    });
    expect(parseRule("FREQ=MONTHLY;BYMONTHDAY=-1")).toEqual({
      freq: "MONTHLY",
      interval: 1,
      byMonthDay: -1,
    });
    expect(parseRule("FREQ=MONTHLY;INTERVAL=2;BYDAY=-1FR")).toEqual({
      freq: "MONTHLY",
      interval: 2,
      byWeekday: { ordinal: -1, weekday: "FR" },
    });
    expect(parseRule("FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29")).toEqual({
      freq: "YEARLY",
      interval: 1,
      byMonth: 2,
      byMonthDay: 29,
    });
  });

  it("formats canonically and round-trips", () => {
    expect(formatRule(parseRule("FREQ=WEEKLY;BYDAY=TH,MO"))).toBe(
      "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TH",
    );
    expect(formatRule(parseRule("BYMONTHDAY=29;BYMONTH=2;FREQ=YEARLY"))).toBe(
      "FREQ=YEARLY;INTERVAL=1;BYMONTH=2;BYMONTHDAY=29",
    );
    expect(formatRule(parseRule("FREQ=MONTHLY;BYDAY=1MO"))).toBe(
      "FREQ=MONTHLY;INTERVAL=1;BYDAY=1MO",
    );
  });

  it.each([
    "",
    "FREQ=HOURLY",
    "FREQ=DAILY;COUNT=5",
    "FREQ=DAILY;INTERVAL=0",
    "FREQ=DAILY;INTERVAL=366",
    "FREQ=DAILY;INTERVAL=1.5",
    "FREQ=DAILY;FREQ=DAILY",
    "FREQ=DAILY;BYDAY=MO",
    "FREQ=WEEKLY",
    "FREQ=WEEKLY;BYDAY=MO,MO",
    "FREQ=WEEKLY;BYDAY=XX",
    "FREQ=MONTHLY",
    "FREQ=MONTHLY;BYMONTHDAY=15;BYDAY=1MO",
    "FREQ=MONTHLY;BYMONTHDAY=32",
    "FREQ=MONTHLY;BYMONTHDAY=0",
    "FREQ=MONTHLY;BYDAY=5MO",
    "FREQ=MONTHLY;BYDAY=MO,TU",
    "FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30",
    "FREQ=YEARLY;BYMONTH=13;BYMONTHDAY=1",
    "FREQ=YEARLY;BYMONTH=6",
  ])("rejects %j", (value) => {
    expect(() => parseRule(value)).toThrow(RecurrenceRuleError);
  });
});
