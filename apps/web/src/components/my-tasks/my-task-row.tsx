import { Repeat } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { toggleCompleteTarget } from "@/lib/my-tasks/target-status";
import { statusName, taskKey } from "@/lib/my-tasks/task-display";
import type { MyTask, MyTaskProject } from "@/lib/my-tasks/types";
import { getPriorityIcon } from "@/lib/priority";
import AssigneeAvatar from "./assignee-avatar";
import CompleteButton from "./complete-button";
import DueLabel from "./due-label";
import ProjectBadge from "./project-badge";

export type MyTaskItemProps = {
  task: MyTask;
  project?: MyTaskProject;
  now: Date;
  onOpen: (task: MyTask) => void;
  onToggleComplete: (task: MyTask) => void;
};

export default function MyTaskRow({
  task,
  project,
  now,
  onOpen,
  onToggleComplete,
}: MyTaskItemProps) {
  const { t } = useTranslation();
  const canToggle = toggleCompleteTarget(task, project) !== null;

  return (
    <div className="flex min-h-10 items-center gap-3 border-b border-border/60 px-3 py-1.5 hover:bg-muted/40">
      <CompleteButton
        completed={task.completed}
        disabled={!canToggle}
        onToggle={() => onToggleComplete(task)}
      />
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none"
      >
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-sm",
              task.completed && "text-muted-foreground line-through",
            )}
          >
            {task.title}
          </span>
          {task.parent && (
            <span className="block truncate text-xs text-muted-foreground">
              {t("tasks:myTasks.subtaskOf", { title: task.parent.title })}
            </span>
          )}
        </span>
        <span className="hidden w-36 shrink-0 sm:block">
          <ProjectBadge project={project} />
        </span>
        <span className="hidden w-16 shrink-0 text-xs text-muted-foreground sm:block">
          {taskKey(task, project)}
        </span>
        <span className="hidden w-28 shrink-0 truncate text-xs text-muted-foreground sm:block">
          {statusName(task, project, t)}
        </span>
        <span
          className="hidden w-3 shrink-0 justify-center sm:inline-flex"
          title={t(`tasks:priority.${task.priority}`)}
        >
          {getPriorityIcon(task.priority)}
        </span>
        {/* Fixed slot so rows without a due date keep their columns aligned. */}
        <span className="w-14 shrink-0 text-right">
          <DueLabel task={task} now={now} />
        </span>
        <span className="hidden w-5 shrink-0 sm:block">
          {task.assignee && <AssigneeAvatar assignee={task.assignee} />}
        </span>
        <span className="hidden w-3.5 shrink-0 sm:block">
          {task.isRecurring && (
            <Repeat
              aria-label={t("tasks:repeat.repeating")}
              className="size-3.5 text-muted-foreground"
            />
          )}
        </span>
      </button>
    </div>
  );
}
