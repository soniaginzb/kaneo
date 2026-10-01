import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { groupLabel } from "@/lib/my-tasks/group-label";
import type { TaskGroup } from "@/lib/my-tasks/group-tasks";
import type { GroupBy, MyTask, MyTaskProject } from "@/lib/my-tasks/types";
import MyTaskRow from "./my-task-row";

export type MyTasksViewProps = {
  groups: TaskGroup[];
  groupBy: GroupBy;
  projects: MyTaskProject[];
  now: Date;
  onOpen: (task: MyTask) => void;
  onToggleComplete: (task: MyTask) => void;
};

export default function MyTasksList({
  groups,
  groupBy,
  projects,
  now,
  onOpen,
  onToggleComplete,
}: MyTasksViewProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  const toggle = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="flex flex-col">
      {groups
        .filter((group) => group.tasks.length > 0)
        .map((group) => {
          const isCollapsed = collapsed.has(group.key);
          const label = groupLabel(groupBy, group, t);
          return (
            <section key={group.key} aria-label={label}>
              {groupBy !== "none" && (
                <button
                  type="button"
                  aria-expanded={!isCollapsed}
                  onClick={() => toggle(group.key)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium"
                >
                  <ChevronRight
                    className={cn(
                      "size-3.5 text-muted-foreground transition-transform",
                      !isCollapsed && "rotate-90",
                    )}
                  />
                  <span>{label}</span>
                  <span className="text-xs text-muted-foreground">
                    {group.tasks.length}
                  </span>
                </button>
              )}
              {!isCollapsed &&
                group.tasks.map((task) => (
                  <MyTaskRow
                    key={task.id}
                    task={task}
                    project={projectById.get(task.projectId)}
                    now={now}
                    onOpen={onOpen}
                    onToggleComplete={onToggleComplete}
                  />
                ))}
            </section>
          );
        })}
    </div>
  );
}
