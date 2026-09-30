# Recurring Tasks for self-hosted Kaneo — Design

Date: 2026-10-01
Status: Draft, awaiting review
Fork: github.com/soniaginzb/kaneo (public), branch recurring-tasks
Upstream base: usekaneo/kaneo @ e25f53a (2026-09-30)

## Goal

Add Asana-style repeating tasks to a personal build of Kaneo so that a task such as CNT-4 can be set to repeat once, and each time it is marked done the next occurrence appears with the correct due date.

Success: set "Repeat" on a task once; every time it is completed, exactly one new copy appears in the first column with the next due date, its details, and fresh subtasks.

## Decisions

| Topic | Decision |
|---|---|
| Trigger | Next copy is created when the current one is completed (moved into a column with `isFinal = true`). No fixed-schedule mode. |
| Patterns | Every N days; every N weeks on chosen weekdays; every N months on a day-of-month or on the first/second/third/fourth/last weekday; every N years on a date. |
| Next due date | Next rule occurrence after the previous due date. If that is in the past, keep advancing until it is today or later. If the task had no due date, compute from the completion date. |
| Start date | If the source task has a start date, the copy keeps the same start-to-due offset. |
| Copied | Title, description, priority, assignee, labels, custom field values, parent (subtask) links, and the task's own subtasks as fresh copies in their project's first column. |
| Not copied | Comments, attachments, activity, time entries, external links, non-subtask relations. |
| Old task | Stays in its done column. The recurrence rule moves to the new copy. |
| Turning off | "Stop repeating" deletes the rule only. |
| Approach | New `task_recurrence` table plus an event subscriber (Approach A). Upstream task code is left untouched except for the UI row and response wiring. |

## Architecture

### Data: `task_recurrence` table

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | `createId()` |
| `task_id` | text, unique, FK `task.id` ON DELETE CASCADE | One rule per task. Deleting the task deletes the rule. |
| `rrule` | text, not null | RFC 5545 RRULE body, e.g. `FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TH`. |
| `time_zone` | text, not null | IANA zone captured from the browser when the rule is saved, e.g. `Europe/London`. |
| `created_at`, `updated_at` | timestamp | Same conventions as other tables. |

Why `time_zone`: the web app stores due dates as the browser's local midnight converted to UTC. Weekday and day-of-month rules must be evaluated on local wall-clock dates, or "every Monday" can land on Sunday for users east of UTC.

Allowed RRULE subset (validated server-side, anything else rejected with 400):
- `FREQ` ∈ DAILY, WEEKLY, MONTHLY, YEARLY
- `INTERVAL` 1–365
- `BYDAY` (WEEKLY: weekday list; MONTHLY: one ordinal weekday such as `1MO` or `-1FR`)
- `BYMONTHDAY` (MONTHLY: one value 1–31, or -1 for last day)
- `BYMONTH` + `BYMONTHDAY` (YEARLY)
- No `COUNT`, `UNTIL`, `BYSETPOS`, `BYHOUR`, etc.

Migration: one new Drizzle migration generated with drizzle-kit, applied automatically at startup like every other migration. Additive only; no existing table changes.

### Server units (apps/api/src/task-recurrence/)

| File | Responsibility |
|---|---|
| `schema.ts` | Zod/OpenAPI schemas for the rule payload and allowed RRULE subset. |
| `next-occurrence.ts` | Pure function: `(rrule, timeZone, previousDue \| null, completedAt, now) → { dueDate, startDate? }`. Uses the `rrule` package on local wall-clock dates, then converts back to UTC. No DB access. |
| `spawn-next-occurrence.ts` | Given a completed task ID: in one transaction, lock the rule row, confirm it still belongs to that task, create the copy (reusing the duplicate-task field-copy logic), copy subtasks, move the rule to the new task. |
| `subscriber.ts` | Subscribes to `task.status_changed`. If the new status is a final column and the task has a rule, calls `spawnNextOccurrence`. Catches and logs errors. This event is published by every status path (sidebar, board drag via `reorder-tasks`, `bulk-update-tasks`, `update-task`, and the GitHub/GitLab/Gitea integrations), so all of them trigger recurrence. `move-task` (moving to another project) does not and is not a completion. |
| `controllers/` + `index.ts` | Routes: `GET /task-recurrence/:taskId`, `PUT /task-recurrence/:taskId` (create/replace), `DELETE /task-recurrence/:taskId`. Same auth and `task:update` permission checks as other task routes. |

Copy logic: `duplicate-task.ts` already copies title, description, priority, assignee, labels, custom fields and parent links. Extract its copy step into a reusable helper rather than calling the HTTP-level controller, so recurrence can pass the new due/start dates and first-column status. Subtask copies are created in their own project's first column and linked to the new parent with a `subtask` relation.

New task numbers come from the existing `claim-task-numbers` path, so the copy gets the project's next number (e.g. CNT-5).

After creation, publish the normal `task.created` events so the board, websockets and notifications update as for any new task.

### Idempotency and failure handling

- The rule row is locked (`SELECT … FOR UPDATE`) and must still point at the completed task; moving it to the new task happens in the same transaction as creating the copy. A second completion of the old task finds no rule and does nothing.
- Moving the task out of and back into a done column does not spawn again, because the rule has already moved.
- If spawning fails, the transaction rolls back: the task stays completed, the rule stays on it, and the error is logged. Re-completing it (move out, move back) retries.

### Web UI (apps/web)

- New `task-repeat-popover.tsx` and a "Repeat" row in `task-properties-sidebar.tsx` directly under Due date, following the existing popover pattern.
- Popover fields: frequency (Daily / Weekly / Monthly / Yearly), "Every [N]", weekday toggles (weekly), monthly choice (on day X / on the first–fourth or last weekday, prefilled from the due date), a "Next: <date>" preview, "Stop repeating", and Save.
- Row label summarises the rule, e.g. "Weekly on Mon, Thu"; "Doesn't repeat" when unset.
- Small repeat icon on board cards and list rows for tasks with a rule.
- New i18n keys added to `en-US.json`; other locales fall back to English (run `i18n:check:fix` as the repo requires).
- Fetch/mutation hooks follow the existing `hooks/queries` and `hooks/mutations` patterns.

## Code location, build and running

- Fork: `github.com/soniaginzb/kaneo` (fork of `usekaneo/kaneo`), branch `recurring-tasks`, `upstream` remote pointing at usekaneo.
- Local clone: `C:\Users\Admin\Documents\work\kaneo-source`.
- Build: `docker build -f Dockerfile.kaneo -t kaneo-custom:latest .` from the clone.
- Run: in `C:\Users\Admin\Documents\work\kaneo\compose.yml`, change the kaneo image to `kaneo-custom:latest`. `/start-kaneo` and `/close-kaneo` are unchanged.
- Before first switch: `pg_dump` of the live database to `C:\Users\Admin\Documents\work\kaneo\backups\`.
- Rollback: set the image back to `ghcr.io/usekaneo/kaneo:latest`. The extra table is ignored by upstream.
- `UPDATING.md` in the clone documents: fetch upstream, merge into `recurring-tasks`, if migration numbers collide regenerate ours after upstream's, rebuild, restart.

## Testing

1. Unit tests for `next-occurrence.ts`: each pattern; interval > 1; weekday sets; day 31 in short months; last weekday of month; 29 Feb yearly; catch-up when several periods overdue; null previous due; start-date offset; a time zone east and west of UTC.
2. API integration tests (test Postgres, never live data): completing a recurring task creates exactly one copy with correct fields and fresh subtasks; re-completion does not duplicate; non-recurring tasks unaffected; deleting a task removes its rule; invalid RRULE rejected; permission checks; migration applies cleanly on a fresh DB.
3. Browser check: build `kaneo-custom`, run it as a separate throwaway instance on a different port with an empty DB, set Repeat, complete the task, confirm the next copy and date.
4. Only then: back up the live DB, switch compose to `kaneo-custom`, verify existing workspaces, projects and CNT-4 are intact.

## Out of scope

- Fixed-schedule mode (copies appearing whether or not the previous one is done).
- End conditions (repeat until date / N times).
- Upstreaming the feature to usekaneo (possible later; the design keeps it self-contained).
- Recurrence in imports/exports, the MCP server, or the public API docs beyond the new routes' OpenAPI entries.
