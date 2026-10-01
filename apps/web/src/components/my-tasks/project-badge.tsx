import icons from "@/constants/project-icons";
import type { MyTaskProject } from "@/lib/my-tasks/types";

export default function ProjectBadge({ project }: { project?: MyTaskProject }) {
  if (!project) return null;
  const Icon =
    icons[(project.icon ?? "Layout") as keyof typeof icons] || icons.Layout;
  return (
    <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
      <Icon className="size-3 shrink-0" />
      <span className="truncate">{project.name}</span>
    </span>
  );
}
