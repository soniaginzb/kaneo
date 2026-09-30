import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeleteTaskRecurrence } from "@/hooks/mutations/task-recurrence/use-delete-task-recurrence";
import { useSetTaskRecurrence } from "@/hooks/mutations/task-recurrence/use-set-task-recurrence";
import useGetTaskRecurrence from "@/hooks/queries/task-recurrence/use-get-task-recurrence";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatDateShort } from "@/lib/format";
import {
  ordinalLabel,
  weekdayName,
} from "@/lib/task-recurrence/format-rule-summary";
import {
  defaultForm,
  FREQUENCIES,
  type Frequency,
  formToRrule,
  type MonthlyMode,
  monthlyOptions,
  type RepeatForm,
  rruleToForm,
  WEEKDAYS,
  weekdayOf,
  weekOfMonth,
} from "@/lib/task-recurrence/rule-form";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

const FREQUENCY_KEYS: Record<Frequency, string> = {
  DAILY: "tasks:repeat.daily",
  WEEKLY: "tasks:repeat.weekly",
  MONTHLY: "tasks:repeat.monthly",
  YEARLY: "tasks:repeat.yearly",
};

const UNIT_KEYS: Record<Frequency, string> = {
  DAILY: "tasks:repeat.unitDays",
  WEEKLY: "tasks:repeat.unitWeeks",
  MONTHLY: "tasks:repeat.unitMonths",
  YEARLY: "tasks:repeat.unitYears",
};

type TaskRepeatPopoverProps = {
  task: Task;
  children: React.ReactNode;
};

export default function TaskRepeatPopover({
  task,
  children,
}: TaskRepeatPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { canUpdateTasks } = useWorkspacePermission();
  const { data } = useGetTaskRecurrence(task.id);
  const recurrence = data?.recurrence ?? null;
  const reference = task.dueDate ? new Date(task.dueDate) : new Date();
  const [form, setForm] = useState<RepeatForm>(() => defaultForm(reference));
  const { mutateAsync: saveRecurrence, isPending: isSaving } =
    useSetTaskRecurrence();
  const { mutateAsync: stopRecurrence, isPending: isStopping } =
    useDeleteTaskRecurrence();

  if (!canUpdateTasks()) return <>{children}</>;

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setForm(
        recurrence
          ? rruleToForm(recurrence.rrule, reference)
          : defaultForm(reference),
      );
    }
    setOpen(next);
  };

  const monthlyLabel = (mode: MonthlyMode) =>
    mode === "day"
      ? t("tasks:repeat.onDay", { day: reference.getDate() })
      : t("tasks:repeat.onWeekday", {
          ordinal: ordinalLabel(
            mode === "weekday" ? (weekOfMonth(reference) as 1 | 2 | 3 | 4) : -1,
            t,
          ),
          weekday: weekdayName(weekdayOf(reference), "long"),
        });

  const canSave =
    Number.isInteger(form.interval) &&
    form.interval >= 1 &&
    form.interval <= 365 &&
    (form.frequency !== "WEEKLY" || form.weekdays.length > 0);

  const handleSave = async () => {
    try {
      await saveRecurrence({
        taskId: task.id,
        projectId: task.projectId,
        rrule: formToRrule(form, reference),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      toast.success(t("tasks:repeat.saveSuccess"));
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("tasks:repeat.saveError"),
      );
    }
  };

  const handleStop = async () => {
    try {
      await stopRecurrence({ taskId: task.id, projectId: task.projectId });
      toast.success(t("tasks:repeat.stopSuccess"));
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("tasks:repeat.saveError"),
      );
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        <div className="space-y-1.5">
          <Label>{t("tasks:repeat.frequency")}</Label>
          <Select
            value={form.frequency}
            onValueChange={(value) =>
              setForm((current) => ({
                ...current,
                frequency: value as Frequency,
              }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue>{t(FREQUENCY_KEYS[form.frequency])}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {FREQUENCIES.map((frequency) => (
                <SelectItem key={frequency} value={frequency}>
                  {t(FREQUENCY_KEYS[frequency])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor={`repeat-interval-${task.id}`}>
            {t("tasks:repeat.every")}
          </Label>
          <Input
            id={`repeat-interval-${task.id}`}
            type="number"
            min={1}
            max={365}
            className="w-20"
            value={form.interval}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                interval: Number(event.target.value),
              }))
            }
          />
          <span className="text-sm text-muted-foreground">
            {t(UNIT_KEYS[form.frequency])}
          </span>
        </div>

        {form.frequency === "WEEKLY" && (
          <div
            className="flex gap-1"
            role="group"
            aria-label={t("tasks:repeat.on")}
          >
            {WEEKDAYS.map((day) => {
              const selected = form.weekdays.includes(day);
              return (
                <Button
                  key={day}
                  type="button"
                  size="sm"
                  variant={selected ? "default" : "outline"}
                  className="h-7 w-7 p-0 text-xs"
                  aria-pressed={selected}
                  aria-label={weekdayName(day, "long")}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      weekdays: selected
                        ? current.weekdays.filter((entry) => entry !== day)
                        : [...current.weekdays, day],
                    }))
                  }
                >
                  {weekdayName(day, "narrow")}
                </Button>
              );
            })}
          </div>
        )}

        {form.frequency === "MONTHLY" && (
          <Select
            value={form.monthlyMode}
            onValueChange={(value) =>
              setForm((current) => ({
                ...current,
                monthlyMode: value as MonthlyMode,
              }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue>{monthlyLabel(form.monthlyMode)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {monthlyOptions(reference).map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {monthlyLabel(mode)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {recurrence && (
          <p className="text-xs text-muted-foreground">
            {t("tasks:repeat.next", {
              date: formatDateShort(recurrence.nextDueDate),
            })}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
          {recurrence ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStop}
              disabled={isStopping}
            >
              {t("tasks:repeat.stop")}
            </Button>
          ) : (
            <span />
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!canSave || isSaving}
          >
            {t("tasks:repeat.save")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
