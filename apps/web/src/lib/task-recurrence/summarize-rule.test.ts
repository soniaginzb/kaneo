import { describe, expect, it } from "vite-plus/test";
import { summarizeRule } from "./summarize-rule";

describe("summarizeRule", () => {
  it("describes each pattern", () => {
    expect(summarizeRule("FREQ=DAILY;INTERVAL=1")).toEqual({
      kind: "daily",
      interval: 1,
    });
    expect(summarizeRule("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH")).toEqual({
      kind: "weekly",
      interval: 2,
      weekdays: ["MO", "TH"],
    });
    expect(summarizeRule("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=-1")).toEqual({
      kind: "monthly-day",
      interval: 1,
      day: -1,
    });
    expect(summarizeRule("FREQ=MONTHLY;INTERVAL=1;BYDAY=-1FR")).toEqual({
      kind: "monthly-weekday",
      interval: 1,
      ordinal: -1,
      weekday: "FR",
    });
    expect(
      summarizeRule("FREQ=YEARLY;INTERVAL=1;BYMONTH=2;BYMONTHDAY=29"),
    ).toEqual({ kind: "yearly", interval: 1, month: 2, day: 29 });
  });
});
