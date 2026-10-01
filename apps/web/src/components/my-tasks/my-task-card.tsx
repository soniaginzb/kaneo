import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/cn";
import MyTaskCardContent from "./my-task-card-content";
import type { MyTaskItemProps } from "./my-task-row";

export default function MyTaskCard({
  dragEnabled,
  ...props
}: MyTaskItemProps & { dragEnabled: boolean }) {
  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: props.task.id,
    disabled: !dragEnabled,
  });

  // While dragging, the board's floating preview follows the pointer and this
  // card stays in place, dimmed, so the column's scroll area can't clip it.
  return (
    <div
      ref={setNodeRef}
      {...(dragEnabled ? listeners : {})}
      className={cn(
        "rounded-lg border border-border bg-card p-3 shadow-xs",
        isDragging && "opacity-40",
      )}
    >
      <MyTaskCardContent {...props} />
    </div>
  );
}
