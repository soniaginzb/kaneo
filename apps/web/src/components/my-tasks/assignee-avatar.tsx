import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/get-initials";
import type { MyTask } from "@/lib/my-tasks/types";

export default function AssigneeAvatar({
  assignee,
}: {
  assignee: NonNullable<MyTask["assignee"]>;
}) {
  return (
    <span title={assignee.name}>
      <Avatar className="size-5">
        <AvatarImage src={assignee.image ?? ""} alt={assignee.name} />
        <AvatarFallback className="text-[10px]">
          {getInitials(assignee.name)}
        </AvatarFallback>
      </Avatar>
    </span>
  );
}
