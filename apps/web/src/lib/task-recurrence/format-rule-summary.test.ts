import type { TFunction } from "i18next";
import { describe, expect, it } from "vite-plus/test";
import { formatRuleSummary } from "./format-rule-summary";
import { summarizeRule } from "./summarize-rule";

// Echoes the key and its values so the test reads which copy was chosen.
const t = ((key: string, values?: Record<string, unknown>) =>
  values ? `${key} ${JSON.stringify(values)}` : key) as unknown as TFunction;

function describeRule(rrule: string) {
  return formatRuleSummary(summarizeRule(rrule), t);
}

describe("formatRuleSummary", () => {
  it("uses the singular copy for an interval of one", () => {
    expect(describeRule("FREQ=DAILY;INTERVAL=1")).toBe(
      "tasks:repeat.summaryDaily",
    );
    expect(describeRule("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TH")).toBe(
      'tasks:repeat.summaryWeekly {"days":"Mon, Thu"}',
    );
  });

  it("includes the interval otherwise", () => {
    expect(describeRule("FREQ=DAILY;INTERVAL=3")).toBe(
      'tasks:repeat.summaryEveryDays {"n":3}',
    );
    expect(describeRule("FREQ=WEEKLY;INTERVAL=2;BYDAY=FR")).toBe(
      'tasks:repeat.summaryEveryWeeks {"n":2,"days":"Fri"}',
    );
  });

  it("describes monthly day, last day and weekday rules", () => {
    expect(describeRule("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15")).toBe(
      'tasks:repeat.summaryMonthly {"when":"tasks:repeat.whenDay {\\"day\\":15}"}',
    );
    expect(describeRule("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=-1")).toBe(
      'tasks:repeat.summaryMonthly {"when":"tasks:repeat.whenLastDay"}',
    );
    expect(describeRule("FREQ=MONTHLY;INTERVAL=2;BYDAY=-1FR")).toBe(
      'tasks:repeat.summaryEveryMonths {"n":2,"when":"tasks:repeat.whenWeekday {\\"ordinal\\":\\"tasks:repeat.ordinalLast\\",\\"weekday\\":\\"Friday\\"}"}',
    );
  });

  it("describes yearly rules with a month and day", () => {
    expect(describeRule("FREQ=YEARLY;INTERVAL=1;BYMONTH=2;BYMONTHDAY=29")).toBe(
      'tasks:repeat.summaryYearly {"date":"Feb 29"}',
    );
  });
});
