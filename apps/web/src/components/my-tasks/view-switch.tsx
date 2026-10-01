import { PanelsTopLeft, Rows3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { MyTasksView } from "@/lib/my-tasks/types";

type ViewSwitchProps = {
  view: MyTasksView;
  onChange: (view: MyTasksView) => void;
};

export default function ViewSwitch({ view, onChange }: ViewSwitchProps) {
  const { t } = useTranslation();
  return (
    <div className="inline-flex rounded-md border border-border p-0.5">
      {(["list", "board"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={view === option}
          onClick={() => onChange(option)}
          className={cn(
            "inline-flex h-6 items-center gap-1.5 rounded px-2 text-xs",
            view === option
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option === "list" ? (
            <Rows3 className="size-3" />
          ) : (
            <PanelsTopLeft className="size-3" />
          )}
          {t(`tasks:myTasks.view.${option}`)}
        </button>
      ))}
    </div>
  );
}
