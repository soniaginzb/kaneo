# My tasks — design

Date: 2026-10-01
Branch: `my-tasks` (built on `recurring-tasks`)
Scope: fork-only (`soniaginzb/kaneo`). Never proposed upstream.

## Purpose

An Asana-style "My tasks" page: one place to see, across every project in a
workspace, the tasks the signed-in user is responsible for, viewable as a
list or a board, with filtering, sorting and grouping. The user runs a solo
ghostwriting business (Frontmatter Digital) from one workspace with several
client and content projects, and wants to see what is due without opening
each project.

## Decisions (agreed with the user)

| Topic | Decision |
|---|---|
| Which tasks | Assigned to me **plus unassigned** tasks. An Assignee filter narrows to Me or Unassigned. |
| Board columns / list sections | Driven by one **Group by** setting: Due date (default), Project, Priority, Status, None. |
| Board dragging | Only when grouped by **Status** (move to the same-named column in the task's own project) or **Priority** (set priority). No dragging for Due date, Project or None. |
| Completed tasks | Hidden by default. A **Completed** filter: Hide / Last 7 days / Last 30 days / All. |
| Data | One new read-only API endpoint; filtering, sorting and grouping run in the browser. |

## User-facing behaviour

### Entry point

- Sidebar, Overview group: a **My tasks** item first, above Projects.
- Route: `/dashboard/workspace/$workspaceId/my-tasks`.
- Page title "My tasks". Header has a **List | Board** switch (default List).

### Toolbar

- **Search**: case-insensitive substring match on task title.
- **Group by**: Due date (default) · Project · Priority · Status · None.
- **Sort**: Due date (default) · Priority · Project · Created · Title; direction
  asc/desc (default asc). Sorting applies within each group. Ties break by
  project position, then task number, so order is stable.
- **Filter**:
  - Assignee: Me · Unassigned (multi-select; none selected = both).
  - Project: multi-select of the workspace's active projects.
  - Priority: Urgent · High · Medium · Low · No priority.
  - Due: Overdue · Today · This week · Next week · No date (multi-select, OR).
  - Label: label **names** across projects (case-insensitive name match).
  - Completed: Hide (default) · Last 7 days · Last 30 days · All.
- Active filters show as removable chips, with a filter count on the Filter button.
- View, group, sort, direction and filters persist per workspace in the
  existing `user-preferences` store (browser storage). Saved project or label
  values that no longer exist are dropped silently.

### Groups

Group membership is computed on calendar dates in the browser's time zone
(due dates are stored as local midnight). "Today" is the local date.
Weeks start on the user's existing `weekStartsOn` preference.

- **Due date** (fixed order, always shown on the board even when empty):
  1. Overdue — incomplete, due date before today
  2. Today
  3. This week — after today, up to the end of the current week
  4. Next week — the following week
  5. Later — after next week
  6. No date
  7. Completed — only present when the Completed filter is not Hide; holds
     every completed task regardless of due date (completed tasks are never
     Overdue)
- **Project**: one group per project with tasks, in sidebar order
  (`project.position`), labelled with project icon and name.
- **Priority** (fixed, always shown on the board): Urgent · High · Medium · Low
  · No priority.
- **Status**: columns from all projects merged by **slug**. The group label is
  the name of the first column with that slug (by project position, then
  column position). Groups are ordered by the lowest column position the
  slug has in any project; ties by label. Only groups with tasks are shown.
  Completed tasks fall in their real (final) column's group.
- **None**: a single unlabeled group.

### List view

- Collapsible sections, header shows group label and task count.
- Row contents, left to right:
  - **Complete circle** (see Saving changes).
  - Title; subtasks show a second line `↳ <parent title>`.
  - Project icon + name.
  - Task key, e.g. `CNT-4` (`<project slug>-<number>`, exactly as the
    project board).
  - Status (column name).
  - Priority.
  - Due date (destructive colour when overdue).
  - Assignee avatar, or nothing when unassigned.
  - Repeat icon when the task has a repeat rule.
- At narrow widths (< 640px) the row keeps circle, title, due date; the rest
  hide.

### Board view

- One column per group, with the same card content as a list row (minus the
  layout differences). Columns scroll horizontally.
- Drag and drop is enabled only when Group by is Status or Priority.

### Opening a task

Clicking a row or card opens the existing `TaskDetailsSheet` for that task's
project (it already accepts any `projectId`). Closing it returns to My tasks.
The open task id lives in the `taskId` search param, as on project boards.

### Empty states

- No tasks at all: "Nothing on your plate" with a short hint.
- Tasks exist but filters/search hide them all: "N tasks hidden by filters"
  with a **Clear filters** button (clears filters and search, not group/sort).

## Saving changes

All writes use existing endpoints, so permissions, activity, notifications,
websocket broadcasts and recurring-task spawning behave as on project boards.

- **Complete circle (incomplete task)**: set status to the slug of the task's
  project's first final column (`isFinal`, lowest `position`). If the project
  has no final column, the circle is disabled with a tooltip.
- **Complete circle (completed task, shown when Completed ≠ Hide)**: reopen —
  set status to the slug of the project's first non-final column by position.
- **Status drop**: target slug = the group's slug. If the task's project has a
  column with that slug, set status to it. Otherwise the card returns to its
  place and a toast says the project has no such column.
- **Priority drop**: set priority to the group's value.
- Updates are optimistic on the My tasks cache; on error they roll back and a
  toast shows the error.

## API

New module `apps/api/src/my-tasks/` (isolated, like `task-recurrence`),
registered in `apps/api/src/index.ts` wherever other feature APIs are.

`GET /my-tasks/{workspaceId}?completed=hide|7d|30d|all` (default `hide`)

- Middleware: `workspaceAccess.fromParam("workspaceId")` — only members of the
  workspace; others get the existing 403/404 behaviour.
- Selection: tasks whose project belongs to the workspace, project
  `archivedAt IS NULL`, and `assignee_id = <me> OR assignee_id IS NULL`.
- Completion: a task is completed when its status matches a final column of
  its own project (same rule as `taskIsCompleted`).
- `completedAt`: for completed tasks, the `created_at` of the task's latest
  `status_changed` activity; if none, the task's `updated_at`. Null for
  incomplete tasks.
- Completed window: `hide` → only incomplete tasks; `7d`/`30d` → incomplete
  tasks plus completed tasks with `completedAt` within the last 7/30 days of
  server time; `all` → everything.
- Cap: at most 2000 tasks, ordered by due date (nulls last) then created;
  response includes `truncated: boolean`. The page shows a notice when true.

Response:

```ts
{
  tasks: Array<{
    id: string;
    number: number | null;
    title: string;
    status: string;            // column slug
    priority: string;          // urgent | high | medium | low | no-priority
    startDate: string | null;
    dueDate: string | null;
    createdAt: string;
    projectId: string;
    assignee: { id: string; name: string; image: string | null } | null;
    labels: Array<{ id: string; name: string; color: string }>;
    parent: { id: string; title: string } | null;  // subtask relation
    isRecurring: boolean;      // has a task_recurrence row
    completed: boolean;
    completedAt: string | null;
  }>;
  projects: Array<{
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    position: number;
    columns: Array<{ id: string; name: string; slug: string; position: number; isFinal: boolean }>;
  }>;
  truncated: boolean;
}
```

`projects` lists every active project in the workspace (not only those with
tasks), so filters and the complete/reopen targets can be computed.

## Web structure

- `apps/web/src/lib/my-tasks/` — pure, unit-tested logic:
  - `due-bucket.ts` — task → due group given today and `weekStartsOn`.
  - `group-tasks.ts` — tasks + group-by → ordered groups (label, key, tasks).
  - `filter-tasks.ts` — filters + search → filtered tasks.
  - `sort-my-tasks.ts` — sort within groups with stable tie-breaks.
  - `target-status.ts` — complete / reopen / status-drop target slug or null.
  - `preferences.ts` — defaults + normalisation of persisted settings.
- Fetcher + query hook `useMyTasks(workspaceId, completed)`, query key
  `["my-tasks", workspaceId, completed]`.
- Mutation wrappers reuse existing status/priority fetchers and patch the
  `["my-tasks", workspaceId]` cache optimistically.
- `useMyTasksLiveUpdates(workspaceId, projectIds)` — one websocket per active
  project using the existing `getWsUrl`; any task event invalidates
  `["my-tasks", workspaceId]` (debounced ~300 ms). Also refetch on window
  focus.
- Components under `apps/web/src/components/my-tasks/`: toolbar, list view,
  row, board view, card, empty state. They do not depend on `useProjectStore`.
- Route file `.../$workspaceId/my-tasks.tsx`; sidebar entry in `nav-main.tsx`.
- i18n: new `myTasks` keys in `en-US.json`; other locales filled with
  `i18n:check:fix`; regenerate `i18n/schema.json`.

## Testing

- **API integration** (real Postgres): mine + unassigned included; another
  user's tasks excluded; archived project excluded; another workspace
  excluded; non-member refused; each completed window; `completedAt` from
  latest `status_changed` activity with `updated_at` fallback; subtask
  `parent`; `isRecurring`; labels; truncation flag.
- **Web unit**: due buckets (yesterday/today/end-of-week/start-of-next-week/
  later/no date, `weekStartsOn` 0 and 1, completed never Overdue); status
  merge by slug and ordering; priority groups; filters incl. label name match
  and search; sort tie-breaks; target-status for complete/reopen/drop incl.
  missing columns; preference normalisation.
- **Web component**: list renders groups and counts; complete circle calls the
  status mutation with the final slug; status drop to a project without that
  slug shows a toast and does not mutate; empty-state "hidden by filters".
- **Full gate**: lint, typecheck, API unit + integration, web tests.
- **Browser trial** on a throwaway instance before touching the live one.

## Rollout

- No database migration (read-only feature).
- Back up the live database, rebuild `kaneo-custom:latest` from `my-tasks`,
  switch, verify data counts match and the page loads.
- `my-tasks` becomes the build branch for the live image; update
  `UPDATING.md` and the memory note accordingly. Push to `origin` only.

## Out of scope

- Asana-style personal sections.
- Dragging for due-date or project groups; moving tasks between projects.
- Tasks assigned to other people; multiple workspaces on one page.
- Server-side filtering, sorting or pagination beyond the 2000 cap.
