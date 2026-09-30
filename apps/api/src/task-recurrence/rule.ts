import {
  daysInMonth,
  WEEKDAYS,
  type Weekday,
  type WeekdayOrdinal,
} from "./calendar";

export type RecurrenceRule =
  | { freq: "DAILY"; interval: number }
  | { freq: "WEEKLY"; interval: number; byDay: Weekday[] }
  | { freq: "MONTHLY"; interval: number; byMonthDay: number }
  | {
      freq: "MONTHLY";
      interval: number;
      byWeekday: { ordinal: WeekdayOrdinal; weekday: Weekday };
    }
  | { freq: "YEARLY"; interval: number; byMonth: number; byMonthDay: number };

export class RecurrenceRuleError extends Error {}

const SUPPORTED_KEYS = new Set([
  "FREQ",
  "INTERVAL",
  "BYDAY",
  "BYMONTHDAY",
  "BYMONTH",
]);
const ORDINAL_WEEKDAY = /^(-1|[1-4])(MO|TU|WE|TH|FR|SA|SU)$/;

function fail(message: string): never {
  throw new RecurrenceRuleError(message);
}

function integer(value: string, key: string) {
  if (!/^-?\d+$/.test(value)) fail(`${key} must be a whole number`);
  return Number(value);
}

function weekday(value: string): Weekday {
  if (!(WEEKDAYS as readonly string[]).includes(value)) {
    fail(`Unknown weekday "${value}"`);
  }
  return value as Weekday;
}

function allowOnly(
  fields: Map<string, string>,
  allowed: string[],
  freq: string,
) {
  for (const key of fields.keys()) {
    if (!allowed.includes(key)) fail(`${key} is not allowed with FREQ=${freq}`);
  }
}

function required(fields: Map<string, string>, key: string) {
  const value = fields.get(key);
  if (value === undefined) fail(`${key} is required`);
  return value;
}

export function parseRule(value: string): RecurrenceRule {
  const fields = new Map<string, string>();
  for (const part of value.trim().split(";")) {
    const [key, raw, extra] = part.split("=");
    if (!key || !raw || extra !== undefined) {
      fail(`Malformed rule part "${part}"`);
    }
    if (!SUPPORTED_KEYS.has(key)) fail(`Unsupported rule part "${key}"`);
    if (fields.has(key)) fail(`Duplicate rule part "${key}"`);
    fields.set(key, raw);
  }

  const intervalText = fields.get("INTERVAL");
  const interval =
    intervalText === undefined ? 1 : integer(intervalText, "INTERVAL");
  if (interval < 1 || interval > 365) {
    fail("INTERVAL must be between 1 and 365");
  }

  const freq = fields.get("FREQ");
  switch (freq) {
    case "DAILY":
      allowOnly(fields, ["FREQ", "INTERVAL"], freq);
      return { freq, interval };
    case "WEEKLY": {
      allowOnly(fields, ["FREQ", "INTERVAL", "BYDAY"], freq);
      const days = required(fields, "BYDAY").split(",").map(weekday);
      if (new Set(days).size !== days.length) {
        fail("BYDAY lists a weekday twice");
      }
      return {
        freq,
        interval,
        byDay: WEEKDAYS.filter((day) => days.includes(day)),
      };
    }
    case "MONTHLY": {
      allowOnly(fields, ["FREQ", "INTERVAL", "BYDAY", "BYMONTHDAY"], freq);
      const monthDay = fields.get("BYMONTHDAY");
      const byDay = fields.get("BYDAY");
      if ((monthDay === undefined) === (byDay === undefined)) {
        fail("MONTHLY needs exactly one of BYMONTHDAY or BYDAY");
      }
      if (monthDay !== undefined) {
        const day = integer(monthDay, "BYMONTHDAY");
        if (day !== -1 && (day < 1 || day > 31)) {
          fail("BYMONTHDAY must be 1-31 or -1");
        }
        return { freq, interval, byMonthDay: day };
      }
      const match = ORDINAL_WEEKDAY.exec(byDay ?? "");
      if (!match) {
        fail("MONTHLY BYDAY must look like 1MO, 2TU, 3WE, 4TH or -1FR");
      }
      return {
        freq,
        interval,
        byWeekday: {
          ordinal: Number(match[1]) as WeekdayOrdinal,
          weekday: match[2] as Weekday,
        },
      };
    }
    case "YEARLY": {
      allowOnly(fields, ["FREQ", "INTERVAL", "BYMONTH", "BYMONTHDAY"], freq);
      const month = integer(required(fields, "BYMONTH"), "BYMONTH");
      if (month < 1 || month > 12) fail("BYMONTH must be 1-12");
      const day = integer(required(fields, "BYMONTHDAY"), "BYMONTHDAY");
      // 2028 is a leap year, so 29 February is accepted.
      if (day < 1 || day > daysInMonth(2028, month)) {
        fail("BYMONTHDAY does not exist in BYMONTH");
      }
      return { freq, interval, byMonth: month, byMonthDay: day };
    }
    default:
      return fail("FREQ must be DAILY, WEEKLY, MONTHLY or YEARLY");
  }
}

export function formatRule(rule: RecurrenceRule) {
  const parts = [`FREQ=${rule.freq}`, `INTERVAL=${rule.interval}`];
  switch (rule.freq) {
    case "WEEKLY":
      parts.push(`BYDAY=${rule.byDay.join(",")}`);
      break;
    case "MONTHLY":
      parts.push(
        "byMonthDay" in rule
          ? `BYMONTHDAY=${rule.byMonthDay}`
          : `BYDAY=${rule.byWeekday.ordinal}${rule.byWeekday.weekday}`,
      );
      break;
    case "YEARLY":
      parts.push(`BYMONTH=${rule.byMonth}`, `BYMONTHDAY=${rule.byMonthDay}`);
      break;
  }
  return parts.join(";");
}
