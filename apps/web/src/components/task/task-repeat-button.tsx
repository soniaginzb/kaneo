import { Repeat } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import useGetTaskRecurrence from "@/hooks/queries/task-recurrence/use-get-task-recurrence";
import { formatRuleSummary } from "@/lib/task-recurrence/format-rule-summary";
import { summarizeRule } from "@/lib/task-recurrence/summarize-rule";
import type Task from "@/types/task";
import TaskRepeatPopover from "./task-repeat-popover";

export default function TaskRepeatButton({ task }: { task: Task }) {
  const { t } = useTranslation();
  const { data } = useGetTaskRecurrence(task.id);
  const rrule = data?.recurrence?.rrule;

  return (
    <TaskRepeatPopover task={task}>
      <Button
        variant="ghost"
        size="sm"
        className="justify-start h-7 px-1.5 gap-1.5"
      >
        <Repeat className="w-3.5 h-3.5 text-muted-foreground" />
        <span
          className={`text-xs font-semibold ${rrule ? "" : "text-muted-foreground"}`}
        >
          {rrule
            ? formatRuleSummary(summarizeRule(rrule), t)
            : t("tasks:repeat.none")}
        </span>
      </Button>
    </TaskRepeatPopover>
  );
}
