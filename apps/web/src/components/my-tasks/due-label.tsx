import { cn } from "@/lib/cn";
import { formatDateShort } from "@/lib/format";
import { dueBucket } from "@/lib/my-tasks/due-bucket";
import type { MyTask } from "@/lib/my-tasks/types";

export default function DueLabel({ task, now }: { task: MyTask; now: Date }) {
  if (!task.dueDate) return null;
  // Week start does not affect Overdue, so any value works here.
  const overdue =
    !task.completed && dueBucket(task.dueDate, now, 1) === "overdue";
  return (
    <span
      className={cn(
        "shrink-0 text-xs",
        overdue ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {formatDateShort(task.dueDate)}
    </span>
  );
}
