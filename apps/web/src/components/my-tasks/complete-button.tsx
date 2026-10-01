import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

type CompleteButtonProps = {
  completed: boolean;
  disabled: boolean;
  onToggle: () => void;
};

export default function CompleteButton({
  completed,
  disabled,
  onToggle,
}: CompleteButtonProps) {
  const { t } = useTranslation();
  const label = disabled
    ? t("tasks:myTasks.noDoneColumn")
    : completed
      ? t("tasks:myTasks.reopen")
      : t("tasks:myTasks.complete");

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={completed}
      disabled={disabled}
      // Keep the click (and a drag start) from reaching the row or card.
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
        completed
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/50 hover:border-primary",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {completed && <Check className="size-3" />}
    </button>
  );
}
