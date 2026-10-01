import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { TaskGroup } from "@/lib/my-tasks/group-tasks";

type BoardColumnProps = {
  group: TaskGroup;
  label: string;
  droppable: boolean;
  children: ReactNode;
};

export default function BoardColumn({
  group,
  label,
  droppable,
  children,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: group.key,
    disabled: !droppable,
  });
  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg bg-muted/40",
        isOver && "ring-2 ring-primary/40",
      )}
    >
      <header className="flex items-center gap-2 px-3 py-2 text-sm font-medium">
        <span className="truncate">{label}</span>
        <span className="text-xs text-muted-foreground">
          {group.tasks.length}
        </span>
      </header>
      <div className="flex min-h-16 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {children}
      </div>
    </section>
  );
}
