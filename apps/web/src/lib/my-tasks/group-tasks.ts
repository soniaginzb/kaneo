import type { WeekStartDay } from "@/store/user-preferences";
import { DUE_BUCKETS, dueBucket } from "./due-bucket";
import {
  BACKLOG_STATUS,
  type GroupBy,
  type MyTask,
  type MyTaskProject,
  PRIORITIES,
} from "./types";

export type TaskGroup = { key: string; name: string | null; tasks: MyTask[] };

export type GroupOptions = {
  projects: MyTaskProject[];
  now: Date;
  weekStartsOn: WeekStartDay;
  showCompleted: boolean;
};

const byPosition = (a: { position: number }, b: { position: number }) =>
  a.position - b.position;

function fixedGroups(
  keys: readonly string[],
  tasks: MyTask[],
  keyOf: (task: MyTask) => string,
): TaskGroup[] {
  const groups = keys.map((key) => ({
    key,
    name: null,
    tasks: [] as MyTask[],
  }));
  const byKey = new Map(groups.map((group) => [group.key, group]));
  for (const task of tasks) byKey.get(keyOf(task))?.tasks.push(task);
  return groups;
}

function groupByProject(tasks: MyTask[], projects: MyTaskProject[]) {
  const groups = [...projects].sort(byPosition).map((project) => ({
    key: project.id,
    name: project.name,
    tasks: [] as MyTask[],
  }));
  const byKey = new Map(groups.map((group) => [group.key, group]));
  for (const task of tasks) byKey.get(task.projectId)?.tasks.push(task);
  return groups.filter((group) => group.tasks.length > 0);
}

// Columns with the same slug in different projects share a group, named after
// the first project's column and ordered by the lowest position the slug has.
function groupByStatus(tasks: MyTask[], projects: MyTaskProject[]) {
  const info = new Map<string, { name: string | null; order: number }>([
    [BACKLOG_STATUS, { name: null, order: -1 }],
  ]);
  for (const project of [...projects].sort(byPosition)) {
    for (const column of [...project.columns].sort(byPosition)) {
      const known = info.get(column.slug);
      if (known) known.order = Math.min(known.order, column.position);
      else info.set(column.slug, { name: column.name, order: column.position });
    }
  }

  // Every column gets a group, even an empty one, so a board can drop into it.
  const groups = new Map<string, TaskGroup>();
  for (const [slug, column] of info) {
    if (slug === BACKLOG_STATUS) continue;
    groups.set(slug, { key: slug, name: column.name, tasks: [] });
  }
  for (const task of tasks) {
    let group = groups.get(task.status);
    if (!group) {
      const known = info.get(task.status);
      group = {
        key: task.status,
        name: known ? known.name : task.status,
        tasks: [],
      };
      groups.set(task.status, group);
    }
    group.tasks.push(task);
  }

  const orderOf = (key: string) =>
    info.get(key)?.order ?? Number.MAX_SAFE_INTEGER;
  return [...groups.values()].sort(
    (a, b) =>
      orderOf(a.key) - orderOf(b.key) ||
      (a.name ?? "").localeCompare(b.name ?? ""),
  );
}

export function groupMyTasks(
  tasks: MyTask[],
  groupBy: GroupBy,
  options: GroupOptions,
): TaskGroup[] {
  switch (groupBy) {
    case "dueDate":
      return fixedGroups(
        options.showCompleted ? [...DUE_BUCKETS, "completed"] : DUE_BUCKETS,
        tasks,
        (task) =>
          task.completed
            ? "completed"
            : dueBucket(task.dueDate, options.now, options.weekStartsOn),
      );
    case "priority":
      return fixedGroups(PRIORITIES, tasks, (task) =>
        (PRIORITIES as readonly string[]).includes(task.priority)
          ? task.priority
          : "no-priority",
      );
    case "project":
      return groupByProject(tasks, options.projects);
    case "status":
      return groupByStatus(tasks, options.projects);
    case "none":
      return [{ key: "all", name: null, tasks }];
  }
}
