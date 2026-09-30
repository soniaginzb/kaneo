import type { TFunction } from "i18next";
import { formatDate } from "@/lib/format";
import { WEEKDAYS, type Weekday } from "./rule-form";
import type { RuleSummary } from "./summarize-rule";

// 5 Oct 2026 is a Monday, so index 0 lines up with WEEKDAYS.
export function weekdayName(
  weekday: Weekday,
  style: "short" | "long" | "narrow",
) {
  return formatDate(new Date(2026, 9, 5 + WEEKDAYS.indexOf(weekday)), {
    weekday: style,
  });
}

export function ordinalLabel(ordinal: 1 | 2 | 3 | 4 | -1, t: TFunction) {
  return ordinal === -1
    ? t("tasks:repeat.ordinalLast")
    : t(`tasks:repeat.ordinal${ordinal}`);
}

export function formatRuleSummary(summary: RuleSummary, t: TFunction) {
  const n = summary.interval;
  switch (summary.kind) {
    case "daily":
      return n === 1
        ? t("tasks:repeat.summaryDaily")
        : t("tasks:repeat.summaryEveryDays", { n });
    case "weekly": {
      const days = summary.weekdays
        .map((day) => weekdayName(day, "short"))
        .join(", ");
      return n === 1
        ? t("tasks:repeat.summaryWeekly", { days })
        : t("tasks:repeat.summaryEveryWeeks", { n, days });
    }
    case "monthly-day":
    case "monthly-weekday": {
      const when =
        summary.kind === "monthly-weekday"
          ? t("tasks:repeat.whenWeekday", {
              ordinal: ordinalLabel(summary.ordinal, t),
              weekday: weekdayName(summary.weekday, "long"),
            })
          : summary.day === -1
            ? t("tasks:repeat.whenLastDay")
            : t("tasks:repeat.whenDay", { day: summary.day });
      return n === 1
        ? t("tasks:repeat.summaryMonthly", { when })
        : t("tasks:repeat.summaryEveryMonths", { n, when });
    }
    case "yearly": {
      const date = formatDate(new Date(2028, summary.month - 1, summary.day), {
        month: "short",
        day: "numeric",
      });
      return n === 1
        ? t("tasks:repeat.summaryYearly", { date })
        : t("tasks:repeat.summaryEveryYears", { n, date });
    }
  }
}
