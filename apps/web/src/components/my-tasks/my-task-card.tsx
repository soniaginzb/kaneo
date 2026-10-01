import { useDraggable } from "@dnd-kit/core";
import { Repeat } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { toggleCompleteTarget } from "@/lib/my-tasks/target-status";
import { taskKey } from "@/lib/my-tasks/task-display";
import { getPriorityIcon } from "@/lib/priority";
import AssigneeAvatar from "./assignee-avatar";
import CompleteButton from "./complete-button";
import DueLabel from "./due-label";
import type { MyTaskItemProps } from "./my-task-row";
import ProjectBadge from "./project-badge";

export default function MyTaskCard({
  task,
  project,
  now,
  onOpen,
  onToggleComplete,
  dragEnabled,
}: MyTaskItemProps & { dragEnabled: boolean }) {
  const { t } = useTranslation();
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: !dragEnabled,
  });
  const canToggle = toggleCompleteTarget(task, project) !== null;

  return (
    <div
      ref={setNodeRef}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined
      }
      {...(dragEnabled ? listeners : {})}
      className={cn(
        "rounded-lg border border-border bg-card p-3 shadow-xs",
        isDragging && "relative z-10 opacity-80 shadow-md",
      )}
    >
      <div className="flex items-start gap-2">
        <CompleteButton
          completed={task.completed}
          disabled={!canToggle}
          onToggle={() => onToggleComplete(task)}
        />
        <button
          type="button"
          onClick={() => onOpen(task)}
          className="min-w-0 flex-1 text-left outline-none"
        >
          <span
            className={cn(
              "block text-sm",
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
          <span className="mt-2 flex flex-wrap items-center gap-2">
            <ProjectBadge project={project} />
            <span className="text-xs text-muted-foreground">
              {taskKey(task, project)}
            </span>
            <span title={t(`tasks:priority.${task.priority}`)}>
              {getPriorityIcon(task.priority)}
            </span>
            <DueLabel task={task} now={now} />
            {task.assignee && <AssigneeAvatar assignee={task.assignee} />}
            {task.isRecurring && (
              <Repeat
                aria-label={t("tasks:repeat.repeating")}
                className="size-3.5 text-muted-foreground"
              />
            )}
          </span>
        </button>
      </div>
    </div>
  );
}
