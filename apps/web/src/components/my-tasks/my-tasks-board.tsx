import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { groupLabel } from "@/lib/my-tasks/group-label";
import type { TaskGroup } from "@/lib/my-tasks/group-tasks";
import { isDragEnabled } from "@/lib/my-tasks/target-status";
import type { MyTask } from "@/lib/my-tasks/types";
import BoardColumn from "./board-column";
import MyTaskCard from "./my-task-card";
import MyTaskCardContent from "./my-task-card-content";
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
  const [activeTask, setActiveTask] = useState<MyTask | null>(null);
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
  const findTask = (id: string | number) =>
    groups
      .flatMap((column) => column.tasks)
      .find((candidate) => candidate.id === id);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTask(findTask(event.active.id) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const group = columns.find((column) => column.key === event.over?.id);
    const task = findTask(event.active.id);
    if (task && group) onDrop(task, group);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
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
      {/* Rendered outside the columns so their scroll areas can't clip it. */}
      <DragOverlay>
        {activeTask && (
          <div
            data-testid="my-task-drag-preview"
            className="w-72 cursor-grabbing rounded-lg border border-border bg-card p-3 shadow-lg"
          >
            <MyTaskCardContent
              task={activeTask}
              project={projectById.get(activeTask.projectId)}
              now={now}
              onOpen={onOpen}
              onToggleComplete={onToggleComplete}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
