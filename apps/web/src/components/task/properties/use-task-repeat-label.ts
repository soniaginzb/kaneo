import { useTranslation } from "react-i18next";
import useGetTaskRecurrence from "@/hooks/queries/task-recurrence/use-get-task-recurrence";
import { formatRuleSummary } from "@/lib/task-recurrence/format-rule-summary";
import { summarizeRule } from "@/lib/task-recurrence/summarize-rule";

export function useTaskRepeatLabel(taskId: string) {
  const { t } = useTranslation();
  const { data } = useGetTaskRecurrence(taskId);
  const rrule = data?.recurrence?.rrule;

  return {
    isRepeating: Boolean(rrule),
    label: rrule
      ? formatRuleSummary(summarizeRule(rrule), t)
      : t("tasks:repeat.none"),
  };
}
