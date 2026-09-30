export type Weekday = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";
export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export type MonthlyMode = "day" | "weekday" | "last-weekday";

export const WEEKDAYS: readonly Weekday[] = [
  "MO",
  "TU",
  "WE",
  "TH",
  "FR",
  "SA",
  "SU",
];
export const FREQUENCIES: readonly Frequency[] = [
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "YEARLY",
];

export type RepeatForm = {
  frequency: Frequency;
  interval: number;
  weekdays: Weekday[];
  monthlyMode: MonthlyMode;
};

// Everything except frequency, interval and weekdays comes from the reference
// date: the task's due date, or today when it has none.
export function weekdayOf(date: Date): Weekday {
  return WEEKDAYS[(date.getDay() + 6) % 7] as Weekday;
}

export function weekOfMonth(date: Date) {
  return Math.ceil(date.getDate() / 7);
}

function isInLastWeekOfMonth(date: Date) {
  const lastDay = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate();
  return date.getDate() + 7 > lastDay;
}

export function monthlyOptions(reference: Date): MonthlyMode[] {
  return [
    "day",
    ...(reference.getDate() <= 28 ? (["weekday"] as const) : []),
    ...(isInLastWeekOfMonth(reference) ? (["last-weekday"] as const) : []),
  ];
}

export function defaultForm(reference: Date): RepeatForm {
  return {
    frequency: "WEEKLY",
    interval: 1,
    weekdays: [weekdayOf(reference)],
    monthlyMode: "day",
  };
}

export function formToRrule(form: RepeatForm, reference: Date) {
  const parts = [`FREQ=${form.frequency}`, `INTERVAL=${form.interval}`];
  if (form.frequency === "WEEKLY") {
    parts.push(
      `BYDAY=${WEEKDAYS.filter((day) => form.weekdays.includes(day)).join(",")}`,
    );
  }
  if (form.frequency === "MONTHLY") {
    if (form.monthlyMode === "day") {
      parts.push(`BYMONTHDAY=${reference.getDate()}`);
    } else if (form.monthlyMode === "weekday") {
      parts.push(`BYDAY=${weekOfMonth(reference)}${weekdayOf(reference)}`);
    } else {
      parts.push(`BYDAY=-1${weekdayOf(reference)}`);
    }
  }
  if (form.frequency === "YEARLY") {
    parts.push(
      `BYMONTH=${reference.getMonth() + 1}`,
      `BYMONTHDAY=${reference.getDate()}`,
    );
  }
  return parts.join(";");
}

export function rruleToForm(rrule: string, reference: Date): RepeatForm {
  const fields = new Map(
    rrule.split(";").map((part) => part.split("=") as [string, string]),
  );
  const frequency = (fields.get("FREQ") ?? "WEEKLY") as Frequency;
  const byDay = fields.get("BYDAY");
  const savedMode: MonthlyMode =
    frequency !== "MONTHLY" || fields.has("BYMONTHDAY")
      ? "day"
      : byDay?.startsWith("-1")
        ? "last-weekday"
        : "weekday";
  return {
    frequency,
    interval: Number(fields.get("INTERVAL") ?? 1),
    weekdays:
      frequency === "WEEKLY" && byDay
        ? (byDay.split(",") as Weekday[])
        : [weekdayOf(reference)],
    monthlyMode: monthlyOptions(reference).includes(savedMode)
      ? savedMode
      : "day",
  };
}
