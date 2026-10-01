export type MyTaskColumn = {
  id: string;
  name: string;
  slug: string;
  position: number;
  isFinal: boolean;
};

export type MyTaskProject = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  position: number;
  columns: MyTaskColumn[];
};

export type MyTask = {
  id: string;
  number: number | null;
  title: string;
  status: string;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
  projectId: string;
  assignee: { id: string; name: string; image: string | null } | null;
  labels: Array<{ id: string; name: string; color: string }>;
  parent: { id: string; title: string } | null;
  isRecurring: boolean;
  completed: boolean;
  completedAt: string | null;
};

export type MyTasksData = {
  tasks: MyTask[];
  projects: MyTaskProject[];
  truncated: boolean;
};

export const COMPLETED_WINDOWS = ["hide", "7d", "30d", "all"] as const;
export type CompletedWindow = (typeof COMPLETED_WINDOWS)[number];

export const GROUP_BYS = [
  "dueDate",
  "project",
  "priority",
  "status",
  "none",
] as const;
export type GroupBy = (typeof GROUP_BYS)[number];

export const SORT_FIELDS = [
  "dueDate",
  "priority",
  "project",
  "createdAt",
  "title",
] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortDirection = "asc" | "desc";
export type MyTasksSort = { field: SortField; direction: SortDirection };

export const DUE_FILTERS = [
  "overdue",
  "today",
  "thisWeek",
  "nextWeek",
  "noDate",
] as const;
export type DueFilter = (typeof DUE_FILTERS)[number];

export const ASSIGNEE_FILTERS = ["me", "unassigned"] as const;
export type AssigneeFilter = (typeof ASSIGNEE_FILTERS)[number];

export const PRIORITIES = [
  "urgent",
  "high",
  "medium",
  "low",
  "no-priority",
] as const;

// Kaneo's backlog status; it has no column.
export const BACKLOG_STATUS = "planned";

export type MyTasksFilters = {
  assignee: AssigneeFilter[];
  projects: string[];
  priorities: string[];
  due: DueFilter[];
  // Lower-cased label names, so one filter covers same-named labels in every project.
  labels: string[];
};

export type MyTasksView = "list" | "board";

export type MyTasksPreferences = {
  view: MyTasksView;
  groupBy: GroupBy;
  sort: MyTasksSort;
  filters: MyTasksFilters;
  completed: CompletedWindow;
};

export const DEFAULT_FILTERS: MyTasksFilters = {
  assignee: [],
  projects: [],
  priorities: [],
  due: [],
  labels: [],
};

export const DEFAULT_PREFERENCES: MyTasksPreferences = {
  view: "list",
  groupBy: "dueDate",
  sort: { field: "dueDate", direction: "asc" },
  filters: DEFAULT_FILTERS,
  completed: "hide",
};
