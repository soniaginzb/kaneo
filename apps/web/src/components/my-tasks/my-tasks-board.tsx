import {
  DndContext,
  type DragEndEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { groupLabel } from "@/lib/my-tasks/group-label";
import type { TaskGroup } from "@/lib/my-tasks/group-tasks";
import { isDragEnabled } from "@/lib/my-tasks/target-status";
import type { MyTask } from "@/lib/my-tasks/types";
import BoardColumn from "./board-column";
import MyTaskCard from "./my-task-card";
import type { MyTasksViewProps } from "./my-tasks-list";

export default function MyTasksBoard({
  groups,
  groupBy,
  projects,
  now,
  onOpen,
  onToggleComplete,
  onDrop,
}: MyTasksViewProps & { onDrop: (task: MyTask, group: TaskGroup) => void }) {
  const { t } = useTranslation();
  const dragEnabled = isDragEnabled(groupBy);
  // Same sensors as the project board: a short move turns a press into a
  // drag, so a click still opens the task and a touch still scrolls.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );
  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const columns =
    groupBy === "project" || groupBy === "none"
      ? groups.filter((group) => group.tasks.length > 0)
      : groups;

  const handleDragEnd = (event: DragEndEvent) => {
    const group = columns.find((column) => column.key === event.over?.id);
    const task = groups
      .flatMap((column) => column.tasks)
      .find((candidate) => candidate.id === event.active.id);
    if (task && group) onDrop(task, group);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex h-full gap-3 overflow-x-auto pb-3">
        {columns.map((group) => (
          <BoardColumn
            key={group.key}
            group={group}
            label={groupLabel(groupBy, group, t)}
            droppable={dragEnabled}
          >
            {group.tasks.map((task) => (
              <MyTaskCard
                key={task.id}
                task={task}
                project={projectById.get(task.projectId)}
                now={now}
                dragEnabled={dragEnabled}
                onOpen={onOpen}
                onToggleComplete={onToggleComplete}
              />
            ))}
          </BoardColumn>
        ))}
      </div>
    </DndContext>
  );
}
