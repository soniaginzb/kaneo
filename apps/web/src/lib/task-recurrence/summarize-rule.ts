import type { Weekday } from "./rule-form";

export type RuleSummary =
  | { kind: "daily"; interval: number }
  | { kind: "weekly"; interval: number; weekdays: Weekday[] }
  | { kind: "monthly-day"; interval: number; day: number }
  | {
      kind: "monthly-weekday";
      interval: number;
      ordinal: 1 | 2 | 3 | 4 | -1;
      weekday: Weekday;
    }
  | { kind: "yearly"; interval: number; month: number; day: number };

// Rules come from the API in canonical form, so this only reads that shape.
export function summarizeRule(rrule: string): RuleSummary {
  const fields = new Map(
    rrule.split(";").map((part) => part.split("=") as [string, string]),
  );
  const interval = Number(fields.get("INTERVAL") ?? 1);
  const byDay = fields.get("BYDAY") ?? "";
  switch (fields.get("FREQ")) {
    case "WEEKLY":
      return {
        kind: "weekly",
        interval,
        weekdays: byDay.split(",") as Weekday[],
      };
    case "MONTHLY":
      if (fields.has("BYMONTHDAY")) {
        return {
          kind: "monthly-day",
          interval,
          day: Number(fields.get("BYMONTHDAY")),
        };
      }
      return {
        kind: "monthly-weekday",
        interval,
        ordinal: Number(byDay.slice(0, -2)) as 1 | 2 | 3 | 4 | -1,
        weekday: byDay.slice(-2) as Weekday,
      };
    case "YEARLY":
      return {
        kind: "yearly",
        interval,
        month: Number(fields.get("BYMONTH")),
        day: Number(fields.get("BYMONTHDAY")),
      };
    default:
      return { kind: "daily", interval };
  }
}
