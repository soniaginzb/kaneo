# Recurring Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Kaneo task repeat Asana-style: when a repeating task is completed, exactly one fresh copy (with subtasks) appears in the first column with the next due date.

**Architecture:** A new `task_recurrence` table holds one RRULE + IANA time zone per task. A subscriber on the existing `task.status_changed` event calls `spawnNextOccurrence`, which reuses `duplicateTask` (extended with an optional `overrides` argument) to create the copy and, inside the same transaction, moves the rule onto it. Pure, in-house calendar code computes the next due date on local wall-clock dates. The web app adds a "Repeat" row + popover to the task sidebar and a repeat icon on board cards.

**Tech Stack:** Hono + `@hono/zod-openapi`, Drizzle ORM (PostgreSQL), Vitest via `vp` (Vite+), React + TanStack Query, react-i18next, Base UI components in `apps/web/src/components/ui`.

**Spec:** `docs/superpowers/specs/2026-10-01-recurring-tasks-design.md`

## Global Constraints

- Fork-only: all work stays in `github.com/soniaginzb/kaneo`, branch `recurring-tasks`. Never open a pull request, issue or push to `usekaneo/kaneo`. The `upstream` remote is fetch-only; `gh` defaults to `soniaginzb/kaneo`. Do not create `i-didnt-check-my-work.md`.
- Never touch the live database (`C:\Users\Admin\Documents\work\kaneo`, port 5432/5173) until Task 11. Integration tests use a throwaway Postgres on port 5434 whose database name ends in `_test`.
- Supported rules only: `FREQ` ∈ DAILY, WEEKLY, MONTHLY, YEARLY; `INTERVAL` 1–365; WEEKLY needs `BYDAY` list; MONTHLY needs exactly one of `BYMONTHDAY` (1–31 or -1) or one ordinal `BYDAY` (`1`–`4` or `-1` + weekday); YEARLY needs `BYMONTH` + `BYMONTHDAY`. Anything else → HTTP 400.
- Days past the end of a month clamp to the last day (31st → 30 Nov; 29 Feb → 28 Feb in non-leap years). No `rrule` npm dependency.
- Next due date = next occurrence after the previous due date, skipping occurrences before today (in the rule's time zone). No previous due date → count from the completion date at local midnight.
- Copy gets: title, description (with attachments), priority, assignee (or none if no longer assignable), labels, custom fields, parent links, plus fresh subtask copies. Not copied: comments, attachments on comments, activity, time entries, external links, non-subtask relations.
- New copy status = the project's lowest-`position` column. Old task stays done. Rule moves to the copy.
- Follow `AGENTS.md`: thin handlers, `createRoute` + Zod, `HTTPException`, `requireWorkspacePermission`, user-facing copy in `i18n/en-US.json`, run `pnpm openapi:check:fix` after route changes.
- Commit messages use Conventional Commits (repo has commitlint) and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Completing a repeating task through bulk actions or board drag (not the sidebar) must create exactly one copy — test in Task 6 via `PATCH /api/task/bulk`.
2. Moving a completed repeating task out of Done and back into Done must not create a second copy — test in Task 6.
3. Deleting the old completed task after its copy exists must leave the copy's rule intact — test in Task 6.
4. An assignee who has left the workspace must yield an unassigned copy, not a failed spawn — test in Task 6.
5. Due dates saved at local midnight in a time zone east of UTC must keep their weekday ("every Monday" stays Monday) — test in Task 3.

---

## File Structure

**API — new** (`apps/api/src/task-recurrence/`)

| File | Responsibility |
|---|---|
| `calendar.ts` | Pure calendar-date arithmetic (weekday, month length, clamping, nth weekday). |
| `zoned-time.ts` | Convert between UTC instants and wall-clock time in an IANA zone; validate zones. |
| `rule.ts` | Parse/validate/format the supported RRULE subset. |
| `next-occurrence.ts` | `nextDueDate()` — the only place recurrence dates are computed. |
| `spawn-next-occurrence.ts` | Create the next copy + subtasks and move the rule. |
| `subscriber.ts` | Wire `task.status_changed` → `spawnNextOccurrence`. |
| `schema.ts`, `response.ts` | Zod request/response schemas. |
| `describe-recurrence.ts` | Build the API response (adds `nextDueDate`). |
| `controllers/get-task-recurrence.ts`, `set-task-recurrence.ts`, `delete-task-recurrence.ts`, `get-project-recurring-task-ids.ts` | Route behavior. |
| `index.ts` | Routes; imports `./subscriber`. |

**API — modified:** `apps/api/src/database/schema.ts` (table), `apps/api/src/database/index.ts` (schema object), `apps/api/drizzle/00NN_task_recurrence.sql` (generated), `apps/api/src/task/controllers/duplicate-task.ts` (overrides), `apps/api/src/index.ts` (route registration), `apps/docs/openapi.json` (generated).

**Tests — new:** `tests/api/task-recurrence/{calendar,zoned-time,rule,next-occurrence}.test.ts`, `tests/api-integration/{task-recurrence-schema,task-duplicate-overrides,task-recurrence-spawn,task-recurrence-routes}.test.ts`.

**Web — new:** `apps/web/src/lib/task-recurrence/{rule-form,summarize-rule,format-rule-summary}.ts` (+ tests), `apps/web/src/fetchers/task-recurrence/*.ts`, `apps/web/src/hooks/queries/task-recurrence/*.ts`, `apps/web/src/hooks/mutations/task-recurrence/*.ts`, `apps/web/src/components/task/task-repeat-popover.tsx`, `apps/web/src/components/task/task-repeat-button.tsx`.

**Web — modified:** `apps/web/src/components/task/task-properties-sidebar.tsx`, `apps/web/src/components/kanban-board/task-card.tsx`, `apps/web/src/hooks/use-project-websocket.ts`, `i18n/en-US.json` (+ other locales via `i18n:check:fix`).

**Repo:** `UPDATING.md` (new).

All commands run from `C:\Users\Admin\Documents\work\kaneo-source` in Git Bash unless stated.

---

### Task 1: Toolchain, test database, and calendar helpers

**Files:**
- Create: `apps/api/src/task-recurrence/calendar.ts`
- Test: `tests/api/task-recurrence/calendar.test.ts`

**Interfaces:**
- Produces: `type Weekday = "MO"|"TU"|"WE"|"TH"|"FR"|"SA"|"SU"`, `WEEKDAYS: readonly Weekday[]` (Monday first), `type WeekdayOrdinal = 1|2|3|4|-1`, `type CalendarDate = { year: number; month: number /*1-12*/; day: number }`, `toDayNumber(d): number`, `addDays(d, n): CalendarDate`, `compareDates(a, b): number`, `daysInMonth(year, month): number`, `weekdayOf(d): Weekday`, `startOfWeek(d): CalendarDate` (Monday), `monthIndex({year, month}): number`, `fromMonthIndex(i): {year, month}`, `clampedDay(year, month, day): CalendarDate` (day -1 = last), `nthWeekdayOfMonth(year, month, ordinal, weekday): CalendarDate`.

- [ ] **Step 1: Install tooling and dependencies**

```bash
npm install -g pnpm@10.32.1
pnpm install
```
Expected: install completes without errors.

- [ ] **Step 2: Start the throwaway test database (never the live one)**

```bash
docker run -d --name kaneo-test-db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5434:5432 postgres:16-alpine
```
Expected: a container ID. All integration test commands in this plan set `DATABASE_URL=postgresql://postgres:postgres@localhost:5434/kaneo_test`.

- [ ] **Step 3: Write the failing test**

`tests/api/task-recurrence/calendar.test.ts`:
```ts
import { describe, expect, it } from "vite-plus/test";
import {
  addDays,
  clampedDay,
  compareDates,
  daysInMonth,
  fromMonthIndex,
  monthIndex,
  nthWeekdayOfMonth,
  startOfWeek,
  weekdayOf,
} from "../../../apps/api/src/task-recurrence/calendar";

describe("calendar", () => {
  it("knows month lengths including leap years", () => {
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2027, 2)).toBe(28);
    expect(daysInMonth(2026, 11)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it("finds weekdays with Monday first", () => {
    expect(weekdayOf({ year: 2026, month: 10, day: 5 })).toBe("MO");
    expect(weekdayOf({ year: 2026, month: 10, day: 8 })).toBe("TH");
    expect(weekdayOf({ year: 2026, month: 3, day: 8 })).toBe("SU");
  });

  it("adds days across month and year ends", () => {
    expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({ year: 2027, month: 1, day: 1 });
    expect(addDays({ year: 2026, month: 3, day: 1 }, -1)).toEqual({ year: 2026, month: 2, day: 28 });
  });

  it("compares dates", () => {
    expect(compareDates({ year: 2026, month: 10, day: 5 }, { year: 2026, month: 10, day: 6 })).toBeLessThan(0);
    expect(compareDates({ year: 2026, month: 10, day: 5 }, { year: 2026, month: 10, day: 5 })).toBe(0);
  });

  it("finds the Monday that starts a week", () => {
    expect(startOfWeek({ year: 2026, month: 10, day: 8 })).toEqual({ year: 2026, month: 10, day: 5 });
    expect(startOfWeek({ year: 2026, month: 10, day: 5 })).toEqual({ year: 2026, month: 10, day: 5 });
  });

  it("round-trips month indexes", () => {
    expect(fromMonthIndex(monthIndex({ year: 2026, month: 12 }) + 1)).toEqual({ year: 2027, month: 1 });
  });

  it("clamps days past the end of the month", () => {
    expect(clampedDay(2026, 11, 31)).toEqual({ year: 2026, month: 11, day: 30 });
    expect(clampedDay(2027, 2, -1)).toEqual({ year: 2027, month: 2, day: 28 });
    expect(clampedDay(2026, 10, 15)).toEqual({ year: 2026, month: 10, day: 15 });
  });

  it("finds the nth and last weekday of a month", () => {
    expect(nthWeekdayOfMonth(2026, 11, 1, "MO")).toEqual({ year: 2026, month: 11, day: 2 });
    expect(nthWeekdayOfMonth(2026, 11, -1, "FR")).toEqual({ year: 2026, month: 11, day: 27 });
    expect(nthWeekdayOfMonth(2026, 10, -1, "FR")).toEqual({ year: 2026, month: 10, day: 30 });
    expect(nthWeekdayOfMonth(2026, 10, 4, "TH")).toEqual({ year: 2026, month: 10, day: 22 });
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `pnpm --filter @kaneo/api exec vp test run --config vitest.config.ts task-recurrence/calendar`
Expected: FAIL — cannot resolve `task-recurrence/calendar`.

- [ ] **Step 5: Implement**

`apps/api/src/task-recurrence/calendar.ts`:
```ts
export type Weekday = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";
export type WeekdayOrdinal = 1 | 2 | 3 | 4 | -1;

export const WEEKDAYS: readonly Weekday[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

export type CalendarDate = { year: number; month: number; day: number };

const DAY_MS = 86_400_000;

export function toDayNumber(date: CalendarDate) {
  return Math.round(Date.UTC(date.year, date.month - 1, date.day) / DAY_MS);
}

function fromDayNumber(dayNumber: number): CalendarDate {
  const date = new Date(dayNumber * DAY_MS);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function addDays(date: CalendarDate, days: number) {
  return fromDayNumber(toDayNumber(date) + days);
}

export function compareDates(a: CalendarDate, b: CalendarDate) {
  return toDayNumber(a) - toDayNumber(b);
}

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function weekdayOf(date: CalendarDate): Weekday {
  // getUTCDay counts from Sunday; WEEKDAYS starts on Monday.
  const sundayFirst = new Date(toDayNumber(date) * DAY_MS).getUTCDay();
  return WEEKDAYS[(sundayFirst + 6) % 7] as Weekday;
}

export function startOfWeek(date: CalendarDate) {
  return addDays(date, -WEEKDAYS.indexOf(weekdayOf(date)));
}

export function monthIndex(date: { year: number; month: number }) {
  return date.year * 12 + (date.month - 1);
}

export function fromMonthIndex(index: number) {
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

// Day -1 means the month's last day. Days past the end clamp to it, so
// "the 31st" lands on 30 November rather than skipping the month.
export function clampedDay(year: number, month: number, day: number): CalendarDate {
  const last = daysInMonth(year, month);
  return { year, month, day: day === -1 ? last : Math.min(day, last) };
}

export function nthWeekdayOfMonth(
  year: number,
  month: number,
  ordinal: WeekdayOrdinal,
  weekday: Weekday,
): CalendarDate {
  const target = WEEKDAYS.indexOf(weekday);
  if (ordinal === -1) {
    const lastDay = daysInMonth(year, month);
    const lastWeekday = WEEKDAYS.indexOf(weekdayOf({ year, month, day: lastDay }));
    return { year, month, day: lastDay - ((lastWeekday - target + 7) % 7) };
  }
  const firstWeekday = WEEKDAYS.indexOf(weekdayOf({ year, month, day: 1 }));
  return { year, month, day: 1 + ((target - firstWeekday + 7) % 7) + 7 * (ordinal - 1) };
}
```

- [ ] **Step 6: Run it to verify it passes**

Run: `pnpm --filter @kaneo/api exec vp test run --config vitest.config.ts task-recurrence/calendar`
Expected: PASS (8 tests).

- [ ] **Step 7: Commit**

```bash
pnpm exec vp check --fix apps/api/src/task-recurrence tests/api/task-recurrence
git add apps/api/src/task-recurrence/calendar.ts tests/api/task-recurrence/calendar.test.ts
git commit -m "feat(task-recurrence): add calendar date helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Time zones and the rule parser

**Files:**
- Create: `apps/api/src/task-recurrence/zoned-time.ts`, `apps/api/src/task-recurrence/rule.ts`
- Test: `tests/api/task-recurrence/zoned-time.test.ts`, `tests/api/task-recurrence/rule.test.ts`

**Interfaces:**
- Consumes: `Weekday`, `WeekdayOrdinal`, `WEEKDAYS`, `CalendarDate`, `daysInMonth` from Task 1.
- Produces:
  - `type WallClock = CalendarDate & { hour: number; minute: number; second: number; millisecond: number }`
  - `toWallClock(instant: Date, timeZone: string): WallClock`, `fromWallClock(wall: WallClock, timeZone: string): Date`, `isValidTimeZone(timeZone: string): boolean`
  - `type RecurrenceRule = { freq: "DAILY"; interval } | { freq: "WEEKLY"; interval; byDay: Weekday[] } | { freq: "MONTHLY"; interval; byMonthDay: number } | { freq: "MONTHLY"; interval; byWeekday: { ordinal: WeekdayOrdinal; weekday: Weekday } } | { freq: "YEARLY"; interval; byMonth: number; byMonthDay: number }` (all `interval: number`)
  - `class RecurrenceRuleError extends Error`, `parseRule(value: string): RecurrenceRule`, `formatRule(rule: RecurrenceRule): string` (canonical `FREQ;INTERVAL;BYMONTH;BYMONTHDAY;BYDAY` order)

- [ ] **Step 1: Write the failing tests**

`tests/api/task-recurrence/zoned-time.test.ts`:
```ts
import { describe, expect, it } from "vite-plus/test";
import {
  fromWallClock,
  isValidTimeZone,
  toWallClock,
} from "../../../apps/api/src/task-recurrence/zoned-time";

const midnight = { hour: 0, minute: 0, second: 0, millisecond: 0 };

describe("zoned time", () => {
  it("reads wall-clock time east of UTC", () => {
    expect(toWallClock(new Date("2026-10-05T18:30:00Z"), "Asia/Kolkata")).toEqual({
      year: 2026, month: 10, day: 6, ...midnight,
    });
  });

  it("converts local midnight back to UTC on both sides of a DST change", () => {
    expect(fromWallClock({ year: 2026, month: 3, day: 8, ...midnight }, "America/Los_Angeles").toISOString())
      .toBe("2026-03-08T08:00:00.000Z");
    expect(fromWallClock({ year: 2026, month: 3, day: 9, ...midnight }, "America/Los_Angeles").toISOString())
      .toBe("2026-03-09T07:00:00.000Z");
  });

  it("keeps UTC unchanged", () => {
    expect(fromWallClock({ year: 2026, month: 10, day: 5, hour: 17, minute: 0, second: 0, millisecond: 0 }, "UTC").toISOString())
      .toBe("2026-10-05T17:00:00.000Z");
  });

  it("validates IANA zone names", () => {
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
  });
});
```

`tests/api/task-recurrence/rule.test.ts`:
```ts
import { describe, expect, it } from "vite-plus/test";
import {
  formatRule,
  parseRule,
  RecurrenceRuleError,
} from "../../../apps/api/src/task-recurrence/rule";

describe("parseRule", () => {
  it("parses each supported pattern", () => {
    expect(parseRule("FREQ=DAILY")).toEqual({ freq: "DAILY", interval: 1 });
    expect(parseRule("FREQ=DAILY;INTERVAL=3")).toEqual({ freq: "DAILY", interval: 3 });
    expect(parseRule("FREQ=WEEKLY;BYDAY=TH,MO")).toEqual({ freq: "WEEKLY", interval: 1, byDay: ["MO", "TH"] });
    expect(parseRule("FREQ=MONTHLY;BYMONTHDAY=31")).toEqual({ freq: "MONTHLY", interval: 1, byMonthDay: 31 });
    expect(parseRule("FREQ=MONTHLY;BYMONTHDAY=-1")).toEqual({ freq: "MONTHLY", interval: 1, byMonthDay: -1 });
    expect(parseRule("FREQ=MONTHLY;INTERVAL=2;BYDAY=-1FR")).toEqual({
      freq: "MONTHLY", interval: 2, byWeekday: { ordinal: -1, weekday: "FR" },
    });
    expect(parseRule("FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29")).toEqual({
      freq: "YEARLY", interval: 1, byMonth: 2, byMonthDay: 29,
    });
  });

  it("formats canonically and round-trips", () => {
    expect(formatRule(parseRule("FREQ=WEEKLY;BYDAY=TH,MO"))).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TH");
    expect(formatRule(parseRule("BYMONTHDAY=29;BYMONTH=2;FREQ=YEARLY"))).toBe("FREQ=YEARLY;INTERVAL=1;BYMONTH=2;BYMONTHDAY=29");
    expect(formatRule(parseRule("FREQ=MONTHLY;BYDAY=1MO"))).toBe("FREQ=MONTHLY;INTERVAL=1;BYDAY=1MO");
  });

  it.each([
    "",
    "FREQ=HOURLY",
    "FREQ=DAILY;COUNT=5",
    "FREQ=DAILY;INTERVAL=0",
    "FREQ=DAILY;INTERVAL=366",
    "FREQ=DAILY;INTERVAL=1.5",
    "FREQ=DAILY;FREQ=DAILY",
    "FREQ=DAILY;BYDAY=MO",
    "FREQ=WEEKLY",
    "FREQ=WEEKLY;BYDAY=MO,MO",
    "FREQ=WEEKLY;BYDAY=XX",
    "FREQ=MONTHLY",
    "FREQ=MONTHLY;BYMONTHDAY=15;BYDAY=1MO",
    "FREQ=MONTHLY;BYMONTHDAY=32",
    "FREQ=MONTHLY;BYMONTHDAY=0",
    "FREQ=MONTHLY;BYDAY=5MO",
    "FREQ=MONTHLY;BYDAY=MO,TU",
    "FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30",
    "FREQ=YEARLY;BYMONTH=13;BYMONTHDAY=1",
    "FREQ=YEARLY;BYMONTH=6",
  ])("rejects %j", (value) => {
    expect(() => parseRule(value)).toThrow(RecurrenceRuleError);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @kaneo/api exec vp test run --config vitest.config.ts task-recurrence/zoned-time task-recurrence/rule`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `zoned-time.ts`**

```ts
import type { CalendarDate } from "./calendar";

export type WallClock = CalendarDate & {
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

export function isValidTimeZone(timeZone: string) {
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

export function toWallClock(instant: Date, timeZone: string): WallClock {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((entry) => entry.type === type)?.value);
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
    millisecond: instant.getUTCMilliseconds(),
  };
}

function offsetAt(instant: number, timeZone: string) {
  const wall = toWallClock(new Date(instant), timeZone);
  return (
    Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second, wall.millisecond) -
    instant
  );
}

// Offsets differ on either side of a DST change, so the guess is corrected once
// with the offset in force at the first estimate.
export function fromWallClock(wall: WallClock, timeZone: string) {
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second, wall.millisecond);
  const estimate = asUtc - offsetAt(asUtc, timeZone);
  return new Date(asUtc - offsetAt(estimate, timeZone));
}
```

- [ ] **Step 4: Implement `rule.ts`**

```ts
import {
  daysInMonth,
  WEEKDAYS,
  type Weekday,
  type WeekdayOrdinal,
} from "./calendar";

export type RecurrenceRule =
  | { freq: "DAILY"; interval: number }
  | { freq: "WEEKLY"; interval: number; byDay: Weekday[] }
  | { freq: "MONTHLY"; interval: number; byMonthDay: number }
  | {
      freq: "MONTHLY";
      interval: number;
      byWeekday: { ordinal: WeekdayOrdinal; weekday: Weekday };
    }
  | { freq: "YEARLY"; interval: number; byMonth: number; byMonthDay: number };

export class RecurrenceRuleError extends Error {}

const SUPPORTED_KEYS = new Set(["FREQ", "INTERVAL", "BYDAY", "BYMONTHDAY", "BYMONTH"]);
const ORDINAL_WEEKDAY = /^(-1|[1-4])(MO|TU|WE|TH|FR|SA|SU)$/;

function fail(message: string): never {
  throw new RecurrenceRuleError(message);
}

function integer(value: string, key: string) {
  if (!/^-?\d+$/.test(value)) fail(`${key} must be a whole number`);
  return Number(value);
}

function weekday(value: string): Weekday {
  if (!(WEEKDAYS as readonly string[]).includes(value)) fail(`Unknown weekday "${value}"`);
  return value as Weekday;
}

function allowOnly(fields: Map<string, string>, allowed: string[], freq: string) {
  for (const key of fields.keys()) {
    if (!allowed.includes(key)) fail(`${key} is not allowed with FREQ=${freq}`);
  }
}

function required(fields: Map<string, string>, key: string) {
  const value = fields.get(key);
  if (value === undefined) fail(`${key} is required`);
  return value;
}

export function parseRule(value: string): RecurrenceRule {
  const fields = new Map<string, string>();
  for (const part of value.trim().split(";")) {
    const [key, raw, extra] = part.split("=");
    if (!key || !raw || extra !== undefined) fail(`Malformed rule part "${part}"`);
    if (!SUPPORTED_KEYS.has(key)) fail(`Unsupported rule part "${key}"`);
    if (fields.has(key)) fail(`Duplicate rule part "${key}"`);
    fields.set(key, raw);
  }

  const intervalText = fields.get("INTERVAL");
  const interval = intervalText === undefined ? 1 : integer(intervalText, "INTERVAL");
  if (interval < 1 || interval > 365) fail("INTERVAL must be between 1 and 365");

  const freq = fields.get("FREQ");
  switch (freq) {
    case "DAILY":
      allowOnly(fields, ["FREQ", "INTERVAL"], freq);
      return { freq, interval };
    case "WEEKLY": {
      allowOnly(fields, ["FREQ", "INTERVAL", "BYDAY"], freq);
      const days = required(fields, "BYDAY").split(",").map(weekday);
      if (new Set(days).size !== days.length) fail("BYDAY lists a weekday twice");
      return { freq, interval, byDay: WEEKDAYS.filter((day) => days.includes(day)) };
    }
    case "MONTHLY": {
      allowOnly(fields, ["FREQ", "INTERVAL", "BYDAY", "BYMONTHDAY"], freq);
      const monthDay = fields.get("BYMONTHDAY");
      const byDay = fields.get("BYDAY");
      if ((monthDay === undefined) === (byDay === undefined)) {
        fail("MONTHLY needs exactly one of BYMONTHDAY or BYDAY");
      }
      if (monthDay !== undefined) {
        const day = integer(monthDay, "BYMONTHDAY");
        if (day !== -1 && (day < 1 || day > 31)) fail("BYMONTHDAY must be 1-31 or -1");
        return { freq, interval, byMonthDay: day };
      }
      const match = ORDINAL_WEEKDAY.exec(byDay ?? "");
      if (!match) fail("MONTHLY BYDAY must look like 1MO, 2TU, 3WE, 4TH or -1FR");
      return {
        freq,
        interval,
        byWeekday: {
          ordinal: Number(match[1]) as WeekdayOrdinal,
          weekday: match[2] as Weekday,
        },
      };
    }
    case "YEARLY": {
      allowOnly(fields, ["FREQ", "INTERVAL", "BYMONTH", "BYMONTHDAY"], freq);
      const month = integer(required(fields, "BYMONTH"), "BYMONTH");
      if (month < 1 || month > 12) fail("BYMONTH must be 1-12");
      const day = integer(required(fields, "BYMONTHDAY"), "BYMONTHDAY");
      // 2028 is a leap year, so 29 February is accepted.
      if (day < 1 || day > daysInMonth(2028, month)) fail("BYMONTHDAY does not exist in BYMONTH");
      return { freq, interval, byMonth: month, byMonthDay: day };
    }
    default:
      return fail("FREQ must be DAILY, WEEKLY, MONTHLY or YEARLY");
  }
}

export function formatRule(rule: RecurrenceRule) {
  const parts = [`FREQ=${rule.freq}`, `INTERVAL=${rule.interval}`];
  switch (rule.freq) {
    case "WEEKLY":
      parts.push(`BYDAY=${rule.byDay.join(",")}`);
      break;
    case "MONTHLY":
      parts.push(
        "byMonthDay" in rule
          ? `BYMONTHDAY=${rule.byMonthDay}`
          : `BYDAY=${rule.byWeekday.ordinal}${rule.byWeekday.weekday}`,
      );
      break;
    case "YEARLY":
      parts.push(`BYMONTH=${rule.byMonth}`, `BYMONTHDAY=${rule.byMonthDay}`);
      break;
  }
  return parts.join(";");
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @kaneo/api exec vp test run --config vitest.config.ts task-recurrence`
Expected: PASS (calendar 8, zoned-time 4, rule 3 + 20 rejections).

- [ ] **Step 6: Commit**

```bash
pnpm exec vp check --fix apps/api/src/task-recurrence tests/api/task-recurrence
git add apps/api/src/task-recurrence tests/api/task-recurrence
git commit -m "feat(task-recurrence): add time zone helpers and rule parser

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Next due date

**Files:**
- Create: `apps/api/src/task-recurrence/next-occurrence.ts`
- Test: `tests/api/task-recurrence/next-occurrence.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–2.
- Produces: `nextDueDate(input: { rule: RecurrenceRule; timeZone: string; previousDue: Date | null; completedAt: Date; now: Date }): Date`

- [ ] **Step 1: Write the failing test**

`tests/api/task-recurrence/next-occurrence.test.ts`:
```ts
import { describe, expect, it } from "vite-plus/test";
import { nextDueDate } from "../../../apps/api/src/task-recurrence/next-occurrence";
import { parseRule } from "../../../apps/api/src/task-recurrence/rule";

function next(
  rrule: string,
  previousDue: string | null,
  now: string,
  timeZone = "UTC",
) {
  return nextDueDate({
    rule: parseRule(rrule),
    timeZone,
    previousDue: previousDue ? new Date(previousDue) : null,
    completedAt: new Date(now),
    now: new Date(now),
  }).toISOString();
}

describe("nextDueDate", () => {
  it("steps daily patterns", () => {
    expect(next("FREQ=DAILY", "2026-10-05T00:00:00Z", "2026-10-05T12:00:00Z")).toBe("2026-10-06T00:00:00.000Z");
    expect(next("FREQ=DAILY;INTERVAL=3", "2026-10-05T00:00:00Z", "2026-10-05T12:00:00Z")).toBe("2026-10-08T00:00:00.000Z");
  });

  it("keeps the time of day of the previous due date", () => {
    expect(next("FREQ=DAILY", "2026-10-05T17:00:00Z", "2026-10-05T12:00:00Z")).toBe("2026-10-06T17:00:00.000Z");
  });

  it("walks chosen weekdays", () => {
    expect(next("FREQ=WEEKLY;BYDAY=MO,TH", "2026-10-05T00:00:00Z", "2026-10-05T12:00:00Z")).toBe("2026-10-08T00:00:00.000Z");
    expect(next("FREQ=WEEKLY;BYDAY=MO,TH", "2026-10-08T00:00:00Z", "2026-10-08T12:00:00Z")).toBe("2026-10-12T00:00:00.000Z");
  });

  it("skips off-weeks for fortnightly patterns", () => {
    expect(next("FREQ=WEEKLY;INTERVAL=2;BYDAY=FR", "2026-10-02T00:00:00Z", "2026-10-02T12:00:00Z")).toBe("2026-10-16T00:00:00.000Z");
    expect(next("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH", "2026-10-08T00:00:00Z", "2026-10-08T12:00:00Z")).toBe("2026-10-19T00:00:00.000Z");
  });

  it("clamps monthly days to short months without drifting", () => {
    expect(next("FREQ=MONTHLY;BYMONTHDAY=31", "2026-10-31T00:00:00Z", "2026-10-31T12:00:00Z")).toBe("2026-11-30T00:00:00.000Z");
    expect(next("FREQ=MONTHLY;BYMONTHDAY=31", "2026-11-30T00:00:00Z", "2026-11-30T12:00:00Z")).toBe("2026-12-31T00:00:00.000Z");
    expect(next("FREQ=MONTHLY;BYMONTHDAY=-1", "2027-01-31T00:00:00Z", "2027-01-31T12:00:00Z")).toBe("2027-02-28T00:00:00.000Z");
  });

  it("finds nth and last weekdays of the month", () => {
    expect(next("FREQ=MONTHLY;BYDAY=-1FR", "2026-10-30T00:00:00Z", "2026-10-30T12:00:00Z")).toBe("2026-11-27T00:00:00.000Z");
    expect(next("FREQ=MONTHLY;BYDAY=1MO", "2026-10-05T00:00:00Z", "2026-10-05T12:00:00Z")).toBe("2026-11-02T00:00:00.000Z");
  });

  it("honours monthly intervals", () => {
    expect(next("FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=15", "2026-10-15T00:00:00Z", "2026-10-15T12:00:00Z")).toBe("2027-01-15T00:00:00.000Z");
  });

  it("handles 29 February yearly", () => {
    expect(next("FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29", "2028-02-29T00:00:00Z", "2028-02-29T12:00:00Z")).toBe("2029-02-28T00:00:00.000Z");
    expect(next("FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29", "2031-02-28T00:00:00Z", "2031-02-28T12:00:00Z")).toBe("2032-02-29T00:00:00.000Z");
  });

  it("catches up past occurrences instead of scheduling them", () => {
    expect(next("FREQ=DAILY", "2026-09-01T00:00:00Z", "2026-10-05T15:00:00Z")).toBe("2026-10-05T00:00:00.000Z");
    expect(next("FREQ=WEEKLY;INTERVAL=2;BYDAY=FR", "2026-10-02T00:00:00Z", "2026-10-20T09:00:00Z")).toBe("2026-10-30T00:00:00.000Z");
  });

  it("counts from local midnight of the completion date when there was no due date", () => {
    expect(next("FREQ=DAILY", null, "2026-10-05T15:30:00Z")).toBe("2026-10-06T00:00:00.000Z");
    expect(next("FREQ=DAILY", null, "2026-10-05T20:00:00Z", "Asia/Kolkata")).toBe("2026-10-06T18:30:00.000Z");
  });

  it("keeps the weekday for local-midnight due dates east of UTC", () => {
    // Monday 5 Oct 00:00 in Kolkata is Sunday 18:30 UTC.
    expect(next("FREQ=WEEKLY;BYDAY=MO", "2026-10-04T18:30:00Z", "2026-10-05T10:00:00Z", "Asia/Kolkata")).toBe("2026-10-11T18:30:00.000Z");
  });

  it("follows daylight saving changes west of UTC", () => {
    expect(next("FREQ=DAILY", "2026-03-08T08:00:00Z", "2026-03-08T20:00:00Z", "America/Los_Angeles")).toBe("2026-03-09T07:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @kaneo/api exec vp test run --config vitest.config.ts task-recurrence/next-occurrence`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`apps/api/src/task-recurrence/next-occurrence.ts`:
```ts
import {
  addDays,
  type CalendarDate,
  clampedDay,
  compareDates,
  fromMonthIndex,
  monthIndex,
  nthWeekdayOfMonth,
  startOfWeek,
  toDayNumber,
  weekdayOf,
} from "./calendar";
import type { RecurrenceRule } from "./rule";
import { fromWallClock, toWallClock } from "./zoned-time";

// Earliest date in the series strictly after `after`. The series is anchored at
// `anchor` so intervals above 1 keep their rhythm while catching up.
function nextInSeries(
  rule: RecurrenceRule,
  anchor: CalendarDate,
  after: CalendarDate,
): CalendarDate {
  switch (rule.freq) {
    case "DAILY": {
      const elapsed = toDayNumber(after) - toDayNumber(anchor);
      return addDays(anchor, (Math.floor(elapsed / rule.interval) + 1) * rule.interval);
    }
    case "WEEKLY": {
      const anchorWeek = toDayNumber(startOfWeek(anchor));
      for (let offset = 1; offset <= 14 * rule.interval; offset++) {
        const candidate = addDays(after, offset);
        const weeks = (toDayNumber(startOfWeek(candidate)) - anchorWeek) / 7;
        if (weeks % rule.interval === 0 && rule.byDay.includes(weekdayOf(candidate))) {
          return candidate;
        }
      }
      throw new Error("Weekly rule produced no occurrence");
    }
    case "MONTHLY": {
      const anchorMonth = monthIndex(anchor);
      let step = Math.floor((monthIndex(after) - anchorMonth) / rule.interval);
      for (;;) {
        const { year, month } = fromMonthIndex(anchorMonth + step * rule.interval);
        const candidate =
          "byMonthDay" in rule
            ? clampedDay(year, month, rule.byMonthDay)
            : nthWeekdayOfMonth(year, month, rule.byWeekday.ordinal, rule.byWeekday.weekday);
        if (compareDates(candidate, after) > 0) return candidate;
        step++;
      }
    }
    case "YEARLY": {
      let step = Math.floor((after.year - anchor.year) / rule.interval);
      for (;;) {
        const candidate = clampedDay(anchor.year + step * rule.interval, rule.byMonth, rule.byMonthDay);
        if (compareDates(candidate, after) > 0) return candidate;
        step++;
      }
    }
  }
}

export function nextDueDate({
  rule,
  timeZone,
  previousDue,
  completedAt,
  now,
}: {
  rule: RecurrenceRule;
  timeZone: string;
  previousDue: Date | null;
  completedAt: Date;
  now: Date;
}) {
  // Due dates are saved as the browser's local midnight, so rules are
  // evaluated on local calendar dates rather than UTC ones.
  const anchorClock = previousDue
    ? toWallClock(previousDue, timeZone)
    : { ...toWallClock(completedAt, timeZone), hour: 0, minute: 0, second: 0, millisecond: 0 };
  const anchor = { year: anchorClock.year, month: anchorClock.month, day: anchorClock.day };
  const nowClock = toWallClock(now, timeZone);
  const today = { year: nowClock.year, month: nowClock.month, day: nowClock.day };

  let next = nextInSeries(rule, anchor, anchor);
  // A late completion yields one current copy, not a backlog of overdue ones.
  while (compareDates(next, today) < 0) next = nextInSeries(rule, anchor, next);

  return fromWallClock(
    {
      ...next,
      hour: anchorClock.hour,
      minute: anchorClock.minute,
      second: anchorClock.second,
      millisecond: anchorClock.millisecond,
    },
    timeZone,
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --filter @kaneo/api exec vp test run --config vitest.config.ts task-recurrence`
Expected: PASS (all task-recurrence unit tests).

- [ ] **Step 5: Commit**

```bash
pnpm exec vp check --fix apps/api/src/task-recurrence tests/api/task-recurrence
git add apps/api/src/task-recurrence/next-occurrence.ts tests/api/task-recurrence/next-occurrence.test.ts
git commit -m "feat(task-recurrence): compute next due dates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `task_recurrence` table and migration

**Files:**
- Modify: `apps/api/src/database/schema.ts` (append table after `taskRelationTable`, ~line 1040), `apps/api/src/database/index.ts` (import list + `schema` object)
- Create: `apps/api/drizzle/00NN_task_recurrence.sql` + `apps/api/drizzle/meta/*` (generated)
- Test: `tests/api-integration/task-recurrence-schema.test.ts`

**Interfaces:**
- Produces: `taskRecurrenceTable` with columns `id`, `taskId` (unique, FK `task.id` cascade), `rrule`, `timeZone`, `createdAt`, `updatedAt`; exported from `database/schema` and on `schema` in `database/index`.

- [ ] **Step 1: Write the failing test**

`tests/api-integration/task-recurrence-schema.test.ts`:
```ts
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import { createProjectFixture, createWorkspaceMember } from "./helpers/fixtures";

describe("API integration: task_recurrence table", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("stores one rule per task and deletes it with the task", async () => {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({ workspaceId: member.workspace.id });
    const [task] = await db
      .insert(schema.taskTable)
      .values({ projectId: project.id, columnId: columns.todo.id, title: "Typeshare post", status: "to-do", number: 1 })
      .returning();
    if (!task) throw new Error("seed failed");

    await db.insert(schema.taskRecurrenceTable).values({ taskId: task.id, rrule: "FREQ=DAILY;INTERVAL=1", timeZone: "UTC" });
    await expect(
      db.insert(schema.taskRecurrenceTable).values({ taskId: task.id, rrule: "FREQ=DAILY;INTERVAL=2", timeZone: "UTC" }),
    ).rejects.toThrow();

    await db.delete(schema.taskTable).where(eq(schema.taskTable.id, task.id));
    const remaining = await db.select().from(schema.taskRecurrenceTable);
    expect(remaining).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `DATABASE_URL=postgresql://postgres:postgres@localhost:5434/kaneo_test pnpm --filter @kaneo/api exec vp test run --config vitest.integration.config.ts task-recurrence-schema`
Expected: FAIL — `schema.taskRecurrenceTable` is undefined.

- [ ] **Step 3: Add the table**

In `apps/api/src/database/schema.ts`, directly after the closing `);` of `taskRelationTable`:
```ts
export const taskRecurrenceTable = pgTable("task_recurrence", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  taskId: text("task_id")
    .notNull()
    .unique()
    .references(() => taskTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  rrule: text("rrule").notNull(),
  timeZone: text("time_zone").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
```

In `apps/api/src/database/index.ts`: add `taskRecurrenceTable,` to the `from "./schema"` import list (alphabetically after `taskRelationTable`) and `taskRecurrenceTable,` to the `export const schema = { ... }` object next to `taskRelationTable`.

- [ ] **Step 4: Generate and inspect the migration**

```bash
cd apps/api
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/kaneo_test pnpm exec drizzle-kit generate --name task_recurrence
cd ../..
cat apps/api/drizzle/*_task_recurrence.sql
```
Expected generated SQL (the only statements in the file — if it contains anything else, stop and investigate snapshot drift):
```sql
CREATE TABLE "task_recurrence" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"rrule" text NOT NULL,
	"time_zone" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_recurrence_task_id_unique" UNIQUE("task_id")
);
--> statement-breakpoint
ALTER TABLE "task_recurrence" ADD CONSTRAINT "task_recurrence_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;
```

Then make it idempotent by hand, so that renumbering it after a future upstream merge can never fail on a database that already has the table. Replace the file's contents with:
```sql
CREATE TABLE IF NOT EXISTS "task_recurrence" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"rrule" text NOT NULL,
	"time_zone" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_recurrence_task_id_unique" UNIQUE("task_id")
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "task_recurrence" ADD CONSTRAINT "task_recurrence_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
```
Drizzle's migrator tracks files by journal timestamp, not by comparing SQL to the snapshot, so this edit is safe.

- [ ] **Step 5: Run the test to verify it passes**

Run: `DATABASE_URL=postgresql://postgres:postgres@localhost:5434/kaneo_test pnpm --filter @kaneo/api exec vp test run --config vitest.integration.config.ts task-recurrence-schema`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
pnpm exec vp check --fix apps/api/src/database tests/api-integration/task-recurrence-schema.test.ts
git add apps/api/src/database apps/api/drizzle tests/api-integration/task-recurrence-schema.test.ts
git commit -m "feat(task-recurrence): add task_recurrence table

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `duplicateTask` overrides

**Files:**
- Modify: `apps/api/src/task/controllers/duplicate-task.ts`
- Test: `tests/api-integration/task-duplicate-overrides.test.ts`; existing `tests/api-integration/task-duplicate.test.ts` must still pass unchanged.

**Interfaces:**
- Produces:
```ts
export type DuplicateTaskOverrides = {
  status?: string;                // target column slug
  dueDate?: Date | null;
  startDate?: Date | null;
  userId?: string | null;         // null = unassigned
  parents?: { taskId: string; projectId: string }[]; // replaces copied parent links
  inTransaction?: (tx: Transaction, task: typeof taskTable.$inferSelect) => Promise<void>;
};
duplicateTask({ taskId, currentUserId, canUpdateTasks, title?, overrides? }): Promise<typeof taskTable.$inferSelect & { assigneeName?: string }>
```
Omitted override fields keep today's behavior, so the Duplicate button is unaffected.

- [ ] **Step 1: Write the failing test**

`tests/api-integration/task-duplicate-overrides.test.ts`:
```ts
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import duplicateTask from "../../apps/api/src/task/controllers/duplicate-task";
import { resetTestDatabase } from "./helpers/database";
import { createProjectFixture, createWorkspaceMember } from "./helpers/fixtures";

async function seed() {
  const member = await createWorkspaceMember();
  const { project, columns } = await createProjectFixture({ workspaceId: member.workspace.id });
  const [parent, source] = await db
    .insert(schema.taskTable)
    .values([
      { projectId: project.id, columnId: columns.todo.id, title: "Parent", status: "to-do", number: 1 },
      {
        projectId: project.id,
        columnId: columns.done.id,
        title: "Weekly batch",
        status: "done",
        number: 2,
        userId: member.user.id,
        dueDate: new Date("2026-10-05T00:00:00Z"),
        startDate: new Date("2026-10-04T00:00:00Z"),
      },
    ])
    .returning();
  if (!parent || !source) throw new Error("seed failed");
  await db.update(schema.projectTable).set({ lastTaskNumber: 2 }).where(eq(schema.projectTable.id, project.id));
  return { member, project, parent, source };
}

describe("API integration: duplicateTask overrides", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("applies status, dates, assignee and replacement parents", async () => {
    const { member, project, parent, source } = await seed();

    const copy = await duplicateTask({
      taskId: source.id,
      currentUserId: member.user.id,
      canUpdateTasks: true,
      overrides: {
        status: "to-do",
        dueDate: new Date("2026-10-12T00:00:00Z"),
        startDate: null,
        userId: null,
        parents: [{ taskId: parent.id, projectId: project.id }],
      },
    });

    expect(copy.status).toBe("to-do");
    expect(copy.dueDate?.toISOString()).toBe("2026-10-12T00:00:00.000Z");
    expect(copy.startDate).toBeNull();
    expect(copy.userId).toBeNull();
    expect(copy.number).toBe(3);
    const relations = await db.select().from(schema.taskRelationTable).where(eq(schema.taskRelationTable.targetTaskId, copy.id));
    expect(relations).toEqual([expect.objectContaining({ sourceTaskId: parent.id, relationType: "subtask" })]);
  });

  it("keeps source values when overrides are omitted", async () => {
    const { member, source } = await seed();

    const copy = await duplicateTask({ taskId: source.id, currentUserId: member.user.id, canUpdateTasks: true });

    expect(copy.status).toBe("done");
    expect(copy.userId).toBe(member.user.id);
    expect(copy.dueDate?.toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });

  it("rolls the copy back when inTransaction throws", async () => {
    const { member, project, source } = await seed();

    await expect(
      duplicateTask({
        taskId: source.id,
        currentUserId: member.user.id,
        canUpdateTasks: true,
        overrides: {
          inTransaction: async () => {
            throw new Error("abort");
          },
        },
      }),
    ).rejects.toThrow("abort");

    const tasks = await db.select().from(schema.taskTable).where(eq(schema.taskTable.projectId, project.id));
    expect(tasks).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `DATABASE_URL=postgresql://postgres:postgres@localhost:5434/kaneo_test pnpm --filter @kaneo/api exec vp test run --config vitest.integration.config.ts task-duplicate-overrides`
Expected: FAIL — overrides are ignored (status stays "done", userId kept, no rollback).

- [ ] **Step 3: Implement the overrides in `duplicate-task.ts`**

Add below the imports:
```ts
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type DuplicateTaskOverrides = {
  status?: string;
  dueDate?: Date | null;
  startDate?: Date | null;
  userId?: string | null;
  // Replaces the copied parent links, e.g. to hang a copied subtask under a copied parent.
  parents?: { taskId: string; projectId: string }[];
  // Runs inside the copy's transaction; throwing rolls the copy back.
  inTransaction?: (
    tx: Transaction,
    task: typeof taskTable.$inferSelect,
  ) => Promise<void>;
};
```

Change the signature:
```ts
async function duplicateTask({
  taskId,
  currentUserId,
  canUpdateTasks,
  title,
  overrides = {},
}: {
  taskId: string;
  currentUserId: string;
  canUpdateTasks: boolean;
  title?: string;
  overrides?: DuplicateTaskOverrides;
}) {
```

Replace the block from `await assertValidTaskStatus(sourceTask.status, sourceTask.projectId);` through the `columnTable.findFirst` call with:
```ts
  const status = overrides.status ?? sourceTask.status;
  const assigneeId =
    overrides.userId !== undefined ? overrides.userId : sourceTask.userId;

  await assertValidTaskStatus(status, sourceTask.projectId);
  if (assigneeId) await assertAssignableUser(assigneeId, project.workspaceId);
  const column = await db.query.columnTable.findFirst({
    where: and(
      eq(columnTable.projectId, sourceTask.projectId),
      eq(columnTable.slug, status),
    ),
  });
```

Replace `const parentRelations = await db` … `);` (the whole parent query, keeping its comment) with:
```ts
  const parentRelations = overrides.parents
    ? overrides.parents.map((parent) => ({
        parentTaskId: parent.taskId,
        parentProjectId: parent.projectId,
        relationType: "subtask",
      }))
    : await db
        .select({
          parentTaskId: taskRelationTable.sourceTaskId,
          parentProjectId: taskTable.projectId,
          relationType: taskRelationTable.relationType,
        })
        .from(taskRelationTable)
        .innerJoin(taskTable, eq(taskRelationTable.sourceTaskId, taskTable.id))
        .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
        .where(
          and(
            eq(taskRelationTable.targetTaskId, sourceTask.id),
            eq(projectTable.workspaceId, project.workspaceId),
            eq(taskRelationTable.relationType, "subtask"),
          ),
        );
```

Inside the transaction, change `nextTaskPosition(tx, sourceTask.projectId, sourceTask.status, column?.id ?? null)` to use `status`, and change the inserted values:
```ts
          userId: assigneeId,
          title: title?.trim() || sourceTask.title,
          status,
          columnId: column?.id ?? null,
          startDate:
            overrides.startDate !== undefined
              ? overrides.startDate
              : sourceTask.startDate,
          dueDate:
            overrides.dueDate !== undefined
              ? overrides.dueDate
              : sourceTask.dueDate,
```

Directly before `return { task, relations };` inside the transaction add:
```ts
      await overrides.inTransaction?.(tx, task);
```

Change the export line to keep the default export and add nothing else (`export default duplicateTask;` stays).

- [ ] **Step 4: Run the new and existing duplicate tests**

Run: `DATABASE_URL=postgresql://postgres:postgres@localhost:5434/kaneo_test pnpm --filter @kaneo/api exec vp test run --config vitest.integration.config.ts task-duplicate`
Expected: PASS for both `task-duplicate.test.ts` and `task-duplicate-overrides.test.ts`.

- [ ] **Step 5: Typecheck and commit**

```bash
pnpm --filter @kaneo/api typecheck
pnpm exec vp check --fix apps/api/src/task/controllers/duplicate-task.ts tests/api-integration/task-duplicate-overrides.test.ts
git add apps/api/src/task/controllers/duplicate-task.ts tests/api-integration/task-duplicate-overrides.test.ts
git commit -m "feat(task): allow duplicateTask overrides for recurrence

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Spawn the next occurrence on completion

**Files:**
- Create: `apps/api/src/task-recurrence/spawn-next-occurrence.ts`, `apps/api/src/task-recurrence/subscriber.ts`
- Test: `tests/api-integration/task-recurrence-spawn.test.ts`

**Interfaces:**
- Consumes: `duplicateTask` + `DuplicateTaskOverrides` (Task 5), `taskRecurrenceTable` (Task 4), `nextDueDate` (Task 3), `parseRule` (Task 2).
- Produces: `spawnNextOccurrence({ taskId: string; userId?: string; now?: Date }): Promise<{ taskId: string } | null>` — `null` when the task has no rule, is not in a final column, or its rule already moved. `subscriber.ts` has no exports; importing it registers the `task.status_changed` handler.

- [ ] **Step 1: Write the failing test**

`tests/api-integration/task-recurrence-spawn.test.ts`:
```ts
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { spawnNextOccurrence } from "../../apps/api/src/task-recurrence/spawn-next-occurrence";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createProjectFixture, createWorkspaceMember } from "./helpers/fixtures";

const NOW = new Date("2026-10-05T12:00:00Z");

async function seedRecurring({ completed = true } = {}) {
  const member = await createWorkspaceMember();
  const { project, columns } = await createProjectFixture({ workspaceId: member.workspace.id });
  const column = completed ? columns.done : columns.todo;
  const [task, subtask] = await db
    .insert(schema.taskTable)
    .values([
      {
        projectId: project.id,
        columnId: column.id,
        status: column.slug,
        title: "Write one Typeshare post",
        description: "Draft, edit, publish",
        priority: "high",
        number: 1,
        userId: member.user.id,
        dueDate: new Date("2026-10-05T00:00:00Z"),
      },
      {
        projectId: project.id,
        columnId: columns.done.id,
        status: "done",
        title: "Pick a topic",
        number: 2,
        dueDate: new Date("2026-10-04T00:00:00Z"),
      },
    ])
    .returning();
  if (!task || !subtask) throw new Error("seed failed");
  await db.update(schema.projectTable).set({ lastTaskNumber: 2 }).where(eq(schema.projectTable.id, project.id));
  await db.insert(schema.taskRelationTable).values({ sourceTaskId: task.id, targetTaskId: subtask.id, relationType: "subtask" });
  await db.insert(schema.labelTable).values({ name: "content", color: "blue", taskId: task.id, workspaceId: member.workspace.id });
  await db.insert(schema.taskRecurrenceTable).values({ taskId: task.id, rrule: "FREQ=DAILY;INTERVAL=1", timeZone: "UTC" });
  return { member, project, columns, task, subtask };
}

function tasksIn(projectId: string) {
  return db.select().from(schema.taskTable).where(eq(schema.taskTable.projectId, projectId));
}

describe("API integration: spawning recurring tasks", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("creates the next copy with fresh subtasks and moves the rule", async () => {
    const { member, project, task } = await seedRecurring();

    const result = await spawnNextOccurrence({ taskId: task.id, userId: member.user.id, now: NOW });

    expect(result).not.toBeNull();
    const copy = await db.query.taskTable.findFirst({ where: eq(schema.taskTable.id, result?.taskId ?? "") });
    expect(copy).toMatchObject({
      title: "Write one Typeshare post",
      description: "Draft, edit, publish",
      priority: "high",
      status: "to-do",
      number: 3,
      userId: member.user.id,
    });
    expect(copy?.dueDate?.toISOString()).toBe("2026-10-06T00:00:00.000Z");

    const labels = await db.select().from(schema.labelTable).where(eq(schema.labelTable.taskId, copy?.id ?? ""));
    expect(labels.map((label) => label.name)).toEqual(["content"]);

    const rules = await db.select().from(schema.taskRecurrenceTable);
    expect(rules).toEqual([expect.objectContaining({ taskId: copy?.id })]);

    const children = await db
      .select({ task: schema.taskTable })
      .from(schema.taskRelationTable)
      .innerJoin(schema.taskTable, eq(schema.taskRelationTable.targetTaskId, schema.taskTable.id))
      .where(and(eq(schema.taskRelationTable.sourceTaskId, copy?.id ?? ""), eq(schema.taskRelationTable.relationType, "subtask")));
    expect(children).toHaveLength(1);
    expect(children[0]?.task).toMatchObject({ title: "Pick a topic", status: "to-do", number: 4 });
    expect(children[0]?.task.dueDate?.toISOString()).toBe("2026-10-05T00:00:00.000Z");

    expect(await tasksIn(project.id)).toHaveLength(4);
  });

  it("does nothing for a task that is not complete or has no rule", async () => {
    const open = await seedRecurring({ completed: false });
    expect(await spawnNextOccurrence({ taskId: open.task.id, userId: open.member.user.id, now: NOW })).toBeNull();

    await db.delete(schema.taskRecurrenceTable);
    const done = await seedRecurring();
    await db.delete(schema.taskRecurrenceTable).where(eq(schema.taskRecurrenceTable.taskId, done.task.id));
    expect(await spawnNextOccurrence({ taskId: done.task.id, userId: done.member.user.id, now: NOW })).toBeNull();
  });

  it("never spawns twice from the same completed task", async () => {
    const { member, project, task } = await seedRecurring();

    await spawnNextOccurrence({ taskId: task.id, userId: member.user.id, now: NOW });
    const second = await spawnNextOccurrence({ taskId: task.id, userId: member.user.id, now: NOW });

    expect(second).toBeNull();
    expect(await tasksIn(project.id)).toHaveLength(4);
  });

  it("keeps the copy's rule when the old task is deleted", async () => {
    const { member, task } = await seedRecurring();
    const result = await spawnNextOccurrence({ taskId: task.id, userId: member.user.id, now: NOW });

    await db.delete(schema.taskTable).where(eq(schema.taskTable.id, task.id));

    const rules = await db.select().from(schema.taskRecurrenceTable);
    expect(rules).toEqual([expect.objectContaining({ taskId: result?.taskId })]);
  });

  it("creates an unassigned copy when the assignee left the workspace", async () => {
    const { member, task } = await seedRecurring();
    const leaver = await createWorkspaceMember();
    await db.update(schema.taskTable).set({ userId: leaver.user.id }).where(eq(schema.taskTable.id, task.id));

    const result = await spawnNextOccurrence({ taskId: task.id, userId: member.user.id, now: NOW });

    const copy = await db.query.taskTable.findFirst({ where: eq(schema.taskTable.id, result?.taskId ?? "") });
    expect(copy?.userId).toBeNull();
  });

  it("spawns once when completed through the status route and again through bulk update, without repeats on re-completion", async () => {
    const { member, project, task } = await seedRecurring({ completed: false });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const json = { "content-type": "application/json" };

    await app.request(`/api/task/status/${task.id}`, { method: "PUT", headers: json, body: JSON.stringify({ status: "done" }) });
    await vi.waitFor(async () => expect(await tasksIn(project.id)).toHaveLength(4), { timeout: 10_000, interval: 100 });

    // Out of Done and back in: the rule already moved, so nothing new appears.
    await app.request(`/api/task/status/${task.id}`, { method: "PUT", headers: json, body: JSON.stringify({ status: "to-do" }) });
    await app.request(`/api/task/status/${task.id}`, { method: "PUT", headers: json, body: JSON.stringify({ status: "done" }) });

    const [rule] = await db.select().from(schema.taskRecurrenceTable);
    await app.request("/api/task/bulk", {
      method: "PATCH",
      headers: json,
      body: JSON.stringify({ taskIds: [rule?.taskId], operation: "updateStatus", value: "done" }),
    });
    await vi.waitFor(async () => expect(await tasksIn(project.id)).toHaveLength(6), { timeout: 10_000, interval: 100 });
    // Give any stray duplicate handler time to run before asserting nothing else appeared.
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await tasksIn(project.id)).toHaveLength(6);
  }, 30_000);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `DATABASE_URL=postgresql://postgres:postgres@localhost:5434/kaneo_test pnpm --filter @kaneo/api exec vp test run --config vitest.integration.config.ts task-recurrence-spawn`
Expected: FAIL — `spawn-next-occurrence` not found.

- [ ] **Step 3: Implement `spawn-next-occurrence.ts`**

```ts
import { and, asc, eq } from "drizzle-orm";
import db from "../database";
import {
  columnTable,
  projectTable,
  taskRecurrenceTable,
  taskRelationTable,
  taskTable,
} from "../database/schema";
import duplicateTask from "../task/controllers/duplicate-task";
import { taskIsCompleted } from "../task/task-is-completed";
import { assertAssignableUser } from "../utils/assert-assignable-user";
import { nextDueDate } from "./next-occurrence";
import { parseRule } from "./rule";

class RuleAlreadyMoved extends Error {}

async function firstColumnSlug(projectId: string) {
  const [column] = await db
    .select({ slug: columnTable.slug })
    .from(columnTable)
    .where(eq(columnTable.projectId, projectId))
    .orderBy(asc(columnTable.position))
    .limit(1);
  if (!column) throw new Error(`Project ${projectId} has no columns`);
  return column.slug;
}

async function assignableOrNull(userId: string | null, workspaceId: string) {
  if (!userId) return null;
  try {
    await assertAssignableUser(userId, workspaceId);
    return userId;
  } catch {
    return null;
  }
}

function shifted(date: Date | null, shiftMs: number | null) {
  return date && shiftMs !== null ? new Date(date.getTime() + shiftMs) : null;
}

export async function spawnNextOccurrence({
  taskId,
  userId,
  now = new Date(),
}: {
  taskId: string;
  userId?: string;
  now?: Date;
}) {
  const [source] = await db
    .select({
      task: taskTable,
      workspaceId: projectTable.workspaceId,
      isCompleted: taskIsCompleted,
      recurrenceId: taskRecurrenceTable.id,
      rrule: taskRecurrenceTable.rrule,
      timeZone: taskRecurrenceTable.timeZone,
    })
    .from(taskTable)
    .innerJoin(taskRecurrenceTable, eq(taskRecurrenceTable.taskId, taskTable.id))
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(eq(taskTable.id, taskId))
    .limit(1);
  if (!source?.isCompleted) return null;

  const previous = source.task;
  const dueDate = nextDueDate({
    rule: parseRule(source.rrule),
    timeZone: source.timeZone,
    previousDue: previous.dueDate,
    completedAt: now,
    now,
  });
  const startDate =
    previous.startDate && previous.dueDate
      ? new Date(dueDate.getTime() - (previous.dueDate.getTime() - previous.startDate.getTime()))
      : null;
  // Integration webhooks can complete tasks without a signed-in user.
  const actorId = userId ?? previous.userId ?? "";

  let copy: Awaited<ReturnType<typeof duplicateTask>>;
  try {
    copy = await duplicateTask({
      taskId,
      currentUserId: actorId,
      canUpdateTasks: true,
      overrides: {
        status: await firstColumnSlug(previous.projectId),
        dueDate,
        startDate,
        userId: await assignableOrNull(previous.userId, source.workspaceId),
        // Moving the rule in the copy's transaction makes a repeat completion
        // (or a concurrent event) find nothing to move and roll back its copy.
        inTransaction: async (tx, task) => {
          const moved = await tx
            .update(taskRecurrenceTable)
            .set({ taskId: task.id })
            .where(
              and(
                eq(taskRecurrenceTable.id, source.recurrenceId),
                eq(taskRecurrenceTable.taskId, taskId),
              ),
            )
            .returning({ id: taskRecurrenceTable.id });
          if (moved.length === 0) throw new RuleAlreadyMoved();
        },
      },
    });
  } catch (error) {
    if (error instanceof RuleAlreadyMoved) return null;
    throw error;
  }

  const shiftMs = previous.dueDate ? dueDate.getTime() - previous.dueDate.getTime() : null;
  const subtasks = await db
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      userId: taskTable.userId,
      startDate: taskTable.startDate,
      dueDate: taskTable.dueDate,
    })
    .from(taskRelationTable)
    .innerJoin(taskTable, eq(taskRelationTable.targetTaskId, taskTable.id))
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        eq(taskRelationTable.sourceTaskId, taskId),
        eq(taskRelationTable.relationType, "subtask"),
        eq(projectTable.workspaceId, source.workspaceId),
      ),
    )
    .orderBy(asc(taskTable.number));

  // Subtasks are copied after the parent commits; one failing does not undo the rest.
  for (const subtask of subtasks) {
    try {
      await duplicateTask({
        taskId: subtask.id,
        currentUserId: actorId,
        canUpdateTasks: true,
        overrides: {
          status: await firstColumnSlug(subtask.projectId),
          dueDate: shifted(subtask.dueDate, shiftMs),
          startDate: shifted(subtask.startDate, shiftMs),
          userId: await assignableOrNull(subtask.userId, source.workspaceId),
          parents: [{ taskId: copy.id, projectId: copy.projectId }],
        },
      });
    } catch (error) {
      console.error(`Failed to copy subtask ${subtask.id} of recurring task ${taskId}:`, error);
    }
  }

  return { taskId: copy.id };
}
```

- [ ] **Step 4: Implement `subscriber.ts`**

```ts
import { subscribeToEvent } from "../events";
import { spawnNextOccurrence } from "./spawn-next-occurrence";

subscribeToEvent<{ taskId: string; userId?: string }>(
  "task.status_changed",
  async (data) => {
    await spawnNextOccurrence({ taskId: data.taskId, userId: data.userId });
  },
);
```

Temporarily make the route test able to load it: create `apps/api/src/task-recurrence/index.ts` containing only `import "./subscriber";` and add `import "./task-recurrence";` below the `import taskRelation from "./task-relation";` line in `apps/api/src/index.ts`. Task 7 replaces this with the full router.

- [ ] **Step 5: Run it to verify it passes**

Run: `DATABASE_URL=postgresql://postgres:postgres@localhost:5434/kaneo_test pnpm --filter @kaneo/api exec vp test run --config vitest.integration.config.ts task-recurrence-spawn`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
pnpm --filter @kaneo/api typecheck
pnpm exec vp check --fix apps/api/src tests/api-integration/task-recurrence-spawn.test.ts
git add apps/api/src/task-recurrence apps/api/src/index.ts tests/api-integration/task-recurrence-spawn.test.ts
git commit -m "feat(task-recurrence): create the next occurrence on completion

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Recurrence API routes

**Files:**
- Create: `apps/api/src/task-recurrence/schema.ts`, `response.ts`, `describe-recurrence.ts`, `controllers/get-task-recurrence.ts`, `controllers/set-task-recurrence.ts`, `controllers/delete-task-recurrence.ts`, `controllers/get-project-recurring-task-ids.ts`
- Modify: `apps/api/src/task-recurrence/index.ts` (full router), `apps/api/src/index.ts` (register `taskRecurrenceApi`), `apps/docs/openapi.json` (generated)
- Test: `tests/api-integration/task-recurrence-routes.test.ts`

**Interfaces:**
- Produces HTTP API (all under `/api/task-recurrence`):
  - `GET /{taskId}` → `{ recurrence: { taskId, rrule, timeZone, nextDueDate } | null }`
  - `PUT /{taskId}` body `{ rrule: string; timeZone: string }` → `{ taskId, rrule /*canonical*/, timeZone, nextDueDate /*ISO*/ }`; 400 on bad rule/zone
  - `DELETE /{taskId}` → `{ deleted: boolean }`
  - `GET /project/{projectId}` → `{ taskIds: string[] }`
- Web client paths: `client["task-recurrence"][":taskId"].$get/$put/$delete`, `client["task-recurrence"].project[":projectId"].$get`.

- [ ] **Step 1: Write the failing test**

`tests/api-integration/task-recurrence-routes.test.ts`:
```ts
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createProjectFixture, createWorkspaceMember } from "./helpers/fixtures";

async function seed(role = "member") {
  const member = await createWorkspaceMember({ role });
  const { project, columns } = await createProjectFixture({ workspaceId: member.workspace.id });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      columnId: columns.todo.id,
      title: "Typeshare post",
      status: "to-do",
      number: 1,
      dueDate: new Date("2099-01-05T00:00:00Z"),
    })
    .returning();
  if (!task) throw new Error("seed failed");
  return { member, project, task };
}

function put(app: ReturnType<typeof createApp>["app"], taskId: string, body: unknown) {
  return app.request(`/api/task-recurrence/${taskId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("API integration: task recurrence routes", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects anonymous requests", async () => {
    const { task } = await seed();
    mockAnonymousSession();
    const { app } = createApp();
    expect((await app.request(`/api/task-recurrence/${task.id}`)).status).toBe(401);
  });

  it("lets a member set, read, list and stop a rule", async () => {
    const { member, project, task } = await seed();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const saved = await put(app, task.id, { rrule: "FREQ=WEEKLY;BYDAY=TH,MO", timeZone: "UTC" });
    expect(saved.status).toBe(200);
    // 5 Jan 2099 is a Monday, so the next occurrence is Thursday 8 Jan.
    expect(await saved.json()).toEqual({
      taskId: task.id,
      rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TH",
      timeZone: "UTC",
      nextDueDate: "2099-01-08T00:00:00.000Z",
    });

    const read = await app.request(`/api/task-recurrence/${task.id}`);
    expect((await read.json()).recurrence).toMatchObject({ rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TH" });

    const listed = await app.request(`/api/task-recurrence/project/${project.id}`);
    expect(await listed.json()).toEqual({ taskIds: [task.id] });

    const replaced = await put(app, task.id, { rrule: "FREQ=DAILY", timeZone: "Europe/London" });
    expect((await replaced.json()).rrule).toBe("FREQ=DAILY;INTERVAL=1");
    expect(await db.select().from(schema.taskRecurrenceTable)).toHaveLength(1);

    const stopped = await app.request(`/api/task-recurrence/${task.id}`, { method: "DELETE" });
    expect(await stopped.json()).toEqual({ deleted: true });
    expect((await (await app.request(`/api/task-recurrence/${task.id}`)).json()).recurrence).toBeNull();
  });

  it("rejects unsupported rules and unknown time zones", async () => {
    const { member, task } = await seed();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    expect((await put(app, task.id, { rrule: "FREQ=HOURLY", timeZone: "UTC" })).status).toBe(400);
    expect((await put(app, task.id, { rrule: "FREQ=DAILY", timeZone: "Mars/Olympus_Mons" })).status).toBe(400);
  });

  it("blocks viewers and outsiders from changing rules", async () => {
    const viewer = await seed("viewer");
    mockAuthenticatedSession(viewer.member.user);
    expect((await put(createApp().app, viewer.task.id, { rrule: "FREQ=DAILY", timeZone: "UTC" })).status).toBe(403);

    const outsiderId = `user-${randomUUID()}`;
    const [outsider] = await db
      .insert(schema.userTable)
      .values({ id: outsiderId, email: `${outsiderId}@example.com`, emailVerified: true, name: "Outsider" })
      .returning();
    if (!outsider) throw new Error("seed failed");
    mockAuthenticatedSession(outsider);
    expect((await put(createApp().app, viewer.task.id, { rrule: "FREQ=DAILY", timeZone: "UTC" })).status).toBe(403);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `DATABASE_URL=postgresql://postgres:postgres@localhost:5434/kaneo_test pnpm --filter @kaneo/api exec vp test run --config vitest.integration.config.ts task-recurrence-routes`
Expected: FAIL — 404 for `/api/task-recurrence/...`.

- [ ] **Step 3: Schemas and response helper**

`apps/api/src/task-recurrence/schema.ts`:
```ts
import { z } from "../openapi";

export const taskIdParam = z.object({ taskId: z.string() });

export const projectIdParam = z.object({ projectId: z.string() });

export const setTaskRecurrenceBody = z.object({
  rrule: z.string().min(1).max(200).openapi({
    description:
      "RFC 5545 RRULE body, e.g. FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TH. Supported: DAILY; WEEKLY with BYDAY; MONTHLY with BYMONTHDAY (1-31 or -1) or one ordinal BYDAY (1MO-4SU, -1FR); YEARLY with BYMONTH and BYMONTHDAY; INTERVAL 1-365. Days past a month's end clamp to its last day.",
  }),
  timeZone: z.string().min(1).max(64).openapi({
    description: "IANA time zone the rule is evaluated in, e.g. Europe/London.",
  }),
});
```

`apps/api/src/task-recurrence/response.ts`:
```ts
import { z } from "../openapi";

export const taskRecurrenceSchema = z
  .object({
    taskId: z.string(),
    rrule: z.string(),
    timeZone: z.string(),
    nextDueDate: z.string().openapi({
      format: "date-time",
      description: "When the next copy would be due if the task were completed now.",
    }),
  })
  .openapi("TaskRecurrence");

export const taskRecurrenceResultSchema = z
  .object({ recurrence: taskRecurrenceSchema.nullable() })
  .openapi("TaskRecurrenceResult");

export const deletedTaskRecurrenceSchema = z
  .object({ deleted: z.boolean() })
  .openapi("DeletedTaskRecurrence");

export const recurringTaskIdsSchema = z
  .object({ taskIds: z.array(z.string()) })
  .openapi("RecurringTaskIds");
```

`apps/api/src/task-recurrence/describe-recurrence.ts`:
```ts
import { nextDueDate } from "./next-occurrence";
import { parseRule } from "./rule";

export function describeRecurrence(
  recurrence: { taskId: string; rrule: string; timeZone: string; dueDate: Date | null },
  now = new Date(),
) {
  return {
    taskId: recurrence.taskId,
    rrule: recurrence.rrule,
    timeZone: recurrence.timeZone,
    nextDueDate: nextDueDate({
      rule: parseRule(recurrence.rrule),
      timeZone: recurrence.timeZone,
      previousDue: recurrence.dueDate,
      completedAt: now,
      now,
    }).toISOString(),
  };
}
```

- [ ] **Step 4: Controllers**

`controllers/get-task-recurrence.ts`:
```ts
import { eq } from "drizzle-orm";
import db from "../../database";
import { taskRecurrenceTable, taskTable } from "../../database/schema";
import { describeRecurrence } from "../describe-recurrence";

async function getTaskRecurrence(taskId: string) {
  const [row] = await db
    .select({
      rrule: taskRecurrenceTable.rrule,
      timeZone: taskRecurrenceTable.timeZone,
      dueDate: taskTable.dueDate,
    })
    .from(taskRecurrenceTable)
    .innerJoin(taskTable, eq(taskTable.id, taskRecurrenceTable.taskId))
    .where(eq(taskRecurrenceTable.taskId, taskId))
    .limit(1);

  return { recurrence: row ? describeRecurrence({ taskId, ...row }) : null };
}

export default getTaskRecurrence;
```

`controllers/set-task-recurrence.ts`:
```ts
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskRecurrenceTable, taskTable } from "../../database/schema";
import { describeRecurrence } from "../describe-recurrence";
import { formatRule, parseRule, RecurrenceRuleError } from "../rule";
import { isValidTimeZone } from "../zoned-time";

function canonicalRule(rrule: string) {
  try {
    return formatRule(parseRule(rrule));
  } catch (error) {
    if (error instanceof RecurrenceRuleError) {
      throw new HTTPException(400, { message: error.message });
    }
    throw error;
  }
}

async function setTaskRecurrence({
  taskId,
  rrule,
  timeZone,
}: {
  taskId: string;
  rrule: string;
  timeZone: string;
}) {
  const canonical = canonicalRule(rrule);
  if (!isValidTimeZone(timeZone)) {
    throw new HTTPException(400, { message: `Unknown time zone "${timeZone}"` });
  }

  const task = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, taskId),
    columns: { dueDate: true },
  });
  if (!task) throw new HTTPException(404, { message: "Task not found" });

  await db
    .insert(taskRecurrenceTable)
    .values({ taskId, rrule: canonical, timeZone })
    .onConflictDoUpdate({
      target: taskRecurrenceTable.taskId,
      set: { rrule: canonical, timeZone, updatedAt: new Date() },
    });

  return describeRecurrence({ taskId, rrule: canonical, timeZone, dueDate: task.dueDate });
}

export default setTaskRecurrence;
```

`controllers/delete-task-recurrence.ts`:
```ts
import { eq } from "drizzle-orm";
import db from "../../database";
import { taskRecurrenceTable } from "../../database/schema";

async function deleteTaskRecurrence(taskId: string) {
  const deleted = await db
    .delete(taskRecurrenceTable)
    .where(eq(taskRecurrenceTable.taskId, taskId))
    .returning({ id: taskRecurrenceTable.id });
  return { deleted: deleted.length > 0 };
}

export default deleteTaskRecurrence;
```

`controllers/get-project-recurring-task-ids.ts`:
```ts
import { eq } from "drizzle-orm";
import db from "../../database";
import { taskRecurrenceTable, taskTable } from "../../database/schema";

async function getProjectRecurringTaskIds(projectId: string) {
  const rows = await db
    .select({ taskId: taskRecurrenceTable.taskId })
    .from(taskRecurrenceTable)
    .innerJoin(taskTable, eq(taskTable.id, taskRecurrenceTable.taskId))
    .where(eq(taskTable.projectId, projectId));
  return { taskIds: rows.map((row) => row.taskId) };
}

export default getProjectRecurringTaskIds;
```

- [ ] **Step 5: Router**

Replace `apps/api/src/task-recurrence/index.ts` with:
```ts
import { requireEntitlement } from "../billing/require-entitlement-middleware";
import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import deleteTaskRecurrence from "./controllers/delete-task-recurrence";
import getProjectRecurringTaskIds from "./controllers/get-project-recurring-task-ids";
import getTaskRecurrence from "./controllers/get-task-recurrence";
import setTaskRecurrence from "./controllers/set-task-recurrence";
import {
  deletedTaskRecurrenceSchema,
  recurringTaskIdsSchema,
  taskRecurrenceResultSchema,
  taskRecurrenceSchema,
} from "./response";
import { projectIdParam, setTaskRecurrenceBody, taskIdParam } from "./schema";
import "./subscriber";

const getTaskRecurrenceRoute = createRoute({
  method: "get",
  operationId: "getTaskRecurrence",
  path: "/{taskId}",
  tags: ["Task Recurrence"],
  summary: "Get task recurrence",
  description: "Get the task's repeat rule and the next due date it would produce, or null if the task does not repeat.",
  middleware: [workspaceAccess.fromTaskId("taskId")] as const,
  request: { params: taskIdParam },
  responses: {
    200: jsonResponse("The task's repeat rule", taskRecurrenceResultSchema),
    403: errorResponse("No access to the task's workspace"),
  },
});

const setTaskRecurrenceRoute = createRoute({
  method: "put",
  operationId: "setTaskRecurrence",
  path: "/{taskId}",
  tags: ["Task Recurrence"],
  summary: "Set task recurrence",
  description: "Create or replace the task's repeat rule. When the task is completed, a copy with the next due date is created and the rule moves to it.",
  middleware: [
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["update"] }),
    requireEntitlement,
  ] as const,
  request: {
    params: taskIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: setTaskRecurrenceBody } },
    },
  },
  responses: {
    200: jsonResponse("The saved repeat rule", taskRecurrenceSchema),
    400: errorResponse("Unsupported rule or unknown time zone"),
    403: errorResponse("No workspace access, or missing task:update permission"),
    404: errorResponse("Task not found"),
  },
});

const deleteTaskRecurrenceRoute = createRoute({
  method: "delete",
  operationId: "deleteTaskRecurrence",
  path: "/{taskId}",
  tags: ["Task Recurrence"],
  summary: "Stop task recurrence",
  description: "Remove the task's repeat rule. The task itself is unchanged.",
  middleware: [
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["update"] }),
    requireEntitlement,
  ] as const,
  request: { params: taskIdParam },
  responses: {
    200: jsonResponse("Whether a rule was removed", deletedTaskRecurrenceSchema),
    403: errorResponse("No workspace access, or missing task:update permission"),
  },
});

const getProjectRecurringTaskIdsRoute = createRoute({
  method: "get",
  operationId: "getProjectRecurringTaskIds",
  path: "/project/{projectId}",
  tags: ["Task Recurrence"],
  summary: "List recurring tasks in a project",
  description: "IDs of the project's tasks that have a repeat rule, for board indicators.",
  middleware: [workspaceAccess.fromProjectId("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("Recurring task IDs", recurringTaskIdsSchema),
    403: errorResponse("No access to the project's workspace"),
  },
});

const taskRecurrence = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(getTaskRecurrenceRoute, async (c) =>
    c.json(await getTaskRecurrence(c.req.valid("param").taskId), 200),
  )
  .openapi(setTaskRecurrenceRoute, async (c) => {
    const { taskId } = c.req.valid("param");
    const { rrule, timeZone } = c.req.valid("json");
    return c.json(await setTaskRecurrence({ taskId, rrule, timeZone }), 200);
  })
  .openapi(deleteTaskRecurrenceRoute, async (c) =>
    c.json(await deleteTaskRecurrence(c.req.valid("param").taskId), 200),
  )
  .openapi(getProjectRecurringTaskIdsRoute, async (c) =>
    c.json(await getProjectRecurringTaskIds(c.req.valid("param").projectId), 200),
  );

export default taskRecurrence;
```

- [ ] **Step 6: Register the router in `apps/api/src/index.ts`**

- Replace the temporary `import "./task-recurrence";` with `import taskRecurrence from "./task-recurrence";`.
- After `const taskRelationApi = api.route("/task-relation", taskRelation);` add `const taskRecurrenceApi = api.route("/task-recurrence", taskRecurrence);`.
- Add `taskRecurrenceApi,` after every other `taskRelationApi,` line, and `| typeof taskRecurrenceApi` after `| typeof taskRelationApi`.

Verify: `grep -c "taskRecurrenceApi" apps/api/src/index.ts` equals `grep -c "taskRelationApi" apps/api/src/index.ts`.

- [ ] **Step 7: Run tests, typecheck, regenerate OpenAPI**

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/kaneo_test pnpm --filter @kaneo/api exec vp test run --config vitest.integration.config.ts task-recurrence
pnpm --filter @kaneo/api typecheck
pnpm openapi:check:fix
git diff --stat apps/docs/openapi.json
```
Expected: all `task-recurrence*` integration tests PASS; typecheck clean; `openapi.json` gains the four operations.

- [ ] **Step 8: Commit**

```bash
pnpm exec vp check --fix apps/api/src tests/api-integration/task-recurrence-routes.test.ts
git add apps/api/src apps/docs/openapi.json tests/api-integration/task-recurrence-routes.test.ts
git commit -m "feat(task-recurrence): add recurrence API routes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Web rule helpers, fetchers and hooks

**Files:**
- Create: `apps/web/src/lib/task-recurrence/rule-form.ts`, `rule-form.test.ts`, `summarize-rule.ts`, `summarize-rule.test.ts`
- Create: `apps/web/src/fetchers/task-recurrence/get-task-recurrence.ts`, `set-task-recurrence.ts`, `delete-task-recurrence.ts`, `get-project-recurring-task-ids.ts`
- Create: `apps/web/src/hooks/queries/task-recurrence/use-get-task-recurrence.ts`, `use-project-recurring-task-ids.ts`
- Create: `apps/web/src/hooks/mutations/task-recurrence/use-set-task-recurrence.ts`, `use-delete-task-recurrence.ts`

**Interfaces:**
- Consumes: API from Task 7.
- Produces:
  - `type Weekday`, `WEEKDAYS`, `type Frequency = "DAILY"|"WEEKLY"|"MONTHLY"|"YEARLY"`, `type MonthlyMode = "day"|"weekday"|"last-weekday"`, `type RepeatForm = { frequency; interval: number; weekdays: Weekday[]; monthlyMode }`
  - `weekdayOf(date: Date): Weekday`, `monthlyOptions(reference: Date): MonthlyMode[]`, `defaultForm(reference: Date): RepeatForm`, `formToRrule(form, reference): string`, `rruleToForm(rrule, reference): RepeatForm`
  - `type RuleSummary` (see code) and `summarizeRule(rrule: string): RuleSummary`
  - Query keys: `["task-recurrence", taskId]`, `["task-recurrence", "project", projectId]`
  - `useGetTaskRecurrence(taskId)`, `useProjectRecurringTaskIds(projectId): Set<string> | undefined`, `useSetTaskRecurrence()` (vars `{ taskId, projectId, rrule, timeZone }`), `useDeleteTaskRecurrence()` (vars `{ taskId, projectId }`)

- [ ] **Step 1: Write the failing tests**

`apps/web/src/lib/task-recurrence/rule-form.test.ts`:
```ts
import { describe, expect, it } from "vite-plus/test";
import { defaultForm, formToRrule, monthlyOptions, rruleToForm } from "./rule-form";

// Local-time dates, like the due dates the browser saves.
const monday5Oct = new Date(2026, 9, 5);
const friday30Oct = new Date(2026, 9, 30);

describe("rule form", () => {
  it("defaults to weekly on the reference weekday", () => {
    expect(defaultForm(monday5Oct)).toEqual({ frequency: "WEEKLY", interval: 1, weekdays: ["MO"], monthlyMode: "day" });
  });

  it("builds rules from the form and reference date", () => {
    expect(formToRrule({ frequency: "DAILY", interval: 3, weekdays: [], monthlyMode: "day" }, monday5Oct)).toBe("FREQ=DAILY;INTERVAL=3");
    expect(formToRrule({ frequency: "WEEKLY", interval: 1, weekdays: ["TH", "MO"], monthlyMode: "day" }, monday5Oct)).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TH");
    expect(formToRrule({ frequency: "MONTHLY", interval: 1, weekdays: [], monthlyMode: "day" }, monday5Oct)).toBe("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=5");
    expect(formToRrule({ frequency: "MONTHLY", interval: 1, weekdays: [], monthlyMode: "weekday" }, monday5Oct)).toBe("FREQ=MONTHLY;INTERVAL=1;BYDAY=1MO");
    expect(formToRrule({ frequency: "MONTHLY", interval: 1, weekdays: [], monthlyMode: "last-weekday" }, friday30Oct)).toBe("FREQ=MONTHLY;INTERVAL=1;BYDAY=-1FR");
    expect(formToRrule({ frequency: "YEARLY", interval: 1, weekdays: [], monthlyMode: "day" }, monday5Oct)).toBe("FREQ=YEARLY;INTERVAL=1;BYMONTH=10;BYMONTHDAY=5");
  });

  it("only offers monthly modes that exist for the reference date", () => {
    expect(monthlyOptions(monday5Oct)).toEqual(["day", "weekday"]);
    expect(monthlyOptions(friday30Oct)).toEqual(["day", "last-weekday"]);
    expect(monthlyOptions(new Date(2026, 9, 26))).toEqual(["day", "weekday", "last-weekday"]);
  });

  it("reads saved rules back into the form", () => {
    expect(rruleToForm("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH", monday5Oct)).toEqual({ frequency: "WEEKLY", interval: 2, weekdays: ["MO", "TH"], monthlyMode: "day" });
    expect(rruleToForm("FREQ=MONTHLY;INTERVAL=1;BYDAY=-1FR", friday30Oct)).toMatchObject({ frequency: "MONTHLY", monthlyMode: "last-weekday", weekdays: ["FR"] });
    // A saved "first Monday" rule on a task now due the 30th falls back to "day".
    expect(rruleToForm("FREQ=MONTHLY;INTERVAL=1;BYDAY=1MO", friday30Oct).monthlyMode).toBe("day");
    // Switching a saved daily rule to monthly starts from "on day X".
    expect(rruleToForm("FREQ=DAILY;INTERVAL=1", monday5Oct)).toEqual({ frequency: "DAILY", interval: 1, weekdays: ["MO"], monthlyMode: "day" });
  });
});
```

`apps/web/src/lib/task-recurrence/summarize-rule.test.ts`:
```ts
import { describe, expect, it } from "vite-plus/test";
import { summarizeRule } from "./summarize-rule";

describe("summarizeRule", () => {
  it("describes each pattern", () => {
    expect(summarizeRule("FREQ=DAILY;INTERVAL=1")).toEqual({ kind: "daily", interval: 1 });
    expect(summarizeRule("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH")).toEqual({ kind: "weekly", interval: 2, weekdays: ["MO", "TH"] });
    expect(summarizeRule("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=-1")).toEqual({ kind: "monthly-day", interval: 1, day: -1 });
    expect(summarizeRule("FREQ=MONTHLY;INTERVAL=1;BYDAY=-1FR")).toEqual({ kind: "monthly-weekday", interval: 1, ordinal: -1, weekday: "FR" });
    expect(summarizeRule("FREQ=YEARLY;INTERVAL=1;BYMONTH=2;BYMONTHDAY=29")).toEqual({ kind: "yearly", interval: 1, month: 2, day: 29 });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @kaneo/web exec vp test run --config vitest.config.ts task-recurrence`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the helpers**

`apps/web/src/lib/task-recurrence/rule-form.ts`:
```ts
export type Weekday = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";
export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export type MonthlyMode = "day" | "weekday" | "last-weekday";

export const WEEKDAYS: readonly Weekday[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
export const FREQUENCIES: readonly Frequency[] = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];

export type RepeatForm = {
  frequency: Frequency;
  interval: number;
  weekdays: Weekday[];
  monthlyMode: MonthlyMode;
};

// Everything except frequency, interval and weekdays comes from the reference
// date: the task's due date, or today when it has none.
export function weekdayOf(date: Date): Weekday {
  return WEEKDAYS[(date.getDay() + 6) % 7] as Weekday;
}

export function weekOfMonth(date: Date) {
  return Math.ceil(date.getDate() / 7);
}

function isInLastWeekOfMonth(date: Date) {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return date.getDate() + 7 > lastDay;
}

export function monthlyOptions(reference: Date): MonthlyMode[] {
  return [
    "day",
    ...(reference.getDate() <= 28 ? (["weekday"] as const) : []),
    ...(isInLastWeekOfMonth(reference) ? (["last-weekday"] as const) : []),
  ];
}

export function defaultForm(reference: Date): RepeatForm {
  return { frequency: "WEEKLY", interval: 1, weekdays: [weekdayOf(reference)], monthlyMode: "day" };
}

export function formToRrule(form: RepeatForm, reference: Date) {
  const parts = [`FREQ=${form.frequency}`, `INTERVAL=${form.interval}`];
  if (form.frequency === "WEEKLY") {
    parts.push(`BYDAY=${WEEKDAYS.filter((day) => form.weekdays.includes(day)).join(",")}`);
  }
  if (form.frequency === "MONTHLY") {
    if (form.monthlyMode === "day") parts.push(`BYMONTHDAY=${reference.getDate()}`);
    else if (form.monthlyMode === "weekday") parts.push(`BYDAY=${weekOfMonth(reference)}${weekdayOf(reference)}`);
    else parts.push(`BYDAY=-1${weekdayOf(reference)}`);
  }
  if (form.frequency === "YEARLY") {
    parts.push(`BYMONTH=${reference.getMonth() + 1}`, `BYMONTHDAY=${reference.getDate()}`);
  }
  return parts.join(";");
}

export function rruleToForm(rrule: string, reference: Date): RepeatForm {
  const fields = new Map(rrule.split(";").map((part) => part.split("=") as [string, string]));
  const frequency = (fields.get("FREQ") ?? "WEEKLY") as Frequency;
  const byDay = fields.get("BYDAY");
  const savedMode: MonthlyMode =
    frequency !== "MONTHLY" || fields.has("BYMONTHDAY")
      ? "day"
      : byDay?.startsWith("-1")
        ? "last-weekday"
        : "weekday";
  return {
    frequency,
    interval: Number(fields.get("INTERVAL") ?? 1),
    weekdays:
      frequency === "WEEKLY" && byDay ? (byDay.split(",") as Weekday[]) : [weekdayOf(reference)],
    monthlyMode: monthlyOptions(reference).includes(savedMode) ? savedMode : "day",
  };
}
```

`apps/web/src/lib/task-recurrence/summarize-rule.ts`:
```ts
import type { Weekday } from "./rule-form";

export type RuleSummary =
  | { kind: "daily"; interval: number }
  | { kind: "weekly"; interval: number; weekdays: Weekday[] }
  | { kind: "monthly-day"; interval: number; day: number }
  | { kind: "monthly-weekday"; interval: number; ordinal: 1 | 2 | 3 | 4 | -1; weekday: Weekday }
  | { kind: "yearly"; interval: number; month: number; day: number };

// Rules come from the API in canonical form, so this only reads that shape.
export function summarizeRule(rrule: string): RuleSummary {
  const fields = new Map(rrule.split(";").map((part) => part.split("=") as [string, string]));
  const interval = Number(fields.get("INTERVAL") ?? 1);
  const byDay = fields.get("BYDAY") ?? "";
  switch (fields.get("FREQ")) {
    case "WEEKLY":
      return { kind: "weekly", interval, weekdays: byDay.split(",") as Weekday[] };
    case "MONTHLY":
      if (fields.has("BYMONTHDAY")) {
        return { kind: "monthly-day", interval, day: Number(fields.get("BYMONTHDAY")) };
      }
      return {
        kind: "monthly-weekday",
        interval,
        ordinal: Number(byDay.slice(0, -2)) as 1 | 2 | 3 | 4 | -1,
        weekday: byDay.slice(-2) as Weekday,
      };
    case "YEARLY":
      return { kind: "yearly", interval, month: Number(fields.get("BYMONTH")), day: Number(fields.get("BYMONTHDAY")) };
    default:
      return { kind: "daily", interval };
  }
}
```

- [ ] **Step 4: Run the helper tests to verify they pass**

Run: `pnpm --filter @kaneo/web exec vp test run --config vitest.config.ts task-recurrence`
Expected: PASS.

- [ ] **Step 5: Fetchers**

`apps/web/src/fetchers/task-recurrence/get-task-recurrence.ts`:
```ts
import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function getTaskRecurrence(taskId: string) {
  const response = await client["task-recurrence"][":taskId"].$get({ param: { taskId } });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}

export default getTaskRecurrence;
```

`set-task-recurrence.ts`:
```ts
import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function setTaskRecurrence(taskId: string, body: { rrule: string; timeZone: string }) {
  const response = await client["task-recurrence"][":taskId"].$put({ param: { taskId }, json: body });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}

export default setTaskRecurrence;
```

`delete-task-recurrence.ts`:
```ts
import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function deleteTaskRecurrence(taskId: string) {
  const response = await client["task-recurrence"][":taskId"].$delete({ param: { taskId } });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}

export default deleteTaskRecurrence;
```

`get-project-recurring-task-ids.ts`:
```ts
import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function getProjectRecurringTaskIds(projectId: string) {
  const response = await client["task-recurrence"].project[":projectId"].$get({ param: { projectId } });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}

export default getProjectRecurringTaskIds;
```

- [ ] **Step 6: Hooks**

`apps/web/src/hooks/queries/task-recurrence/use-get-task-recurrence.ts`:
```ts
import { useQuery } from "@tanstack/react-query";
import getTaskRecurrence from "@/fetchers/task-recurrence/get-task-recurrence";

function useGetTaskRecurrence(taskId: string) {
  return useQuery({
    queryKey: ["task-recurrence", taskId],
    queryFn: () => getTaskRecurrence(taskId),
    enabled: !!taskId,
  });
}

export default useGetTaskRecurrence;
```

`use-project-recurring-task-ids.ts`:
```ts
import { useQuery } from "@tanstack/react-query";
import getProjectRecurringTaskIds from "@/fetchers/task-recurrence/get-project-recurring-task-ids";

const toSet = (result: { taskIds: string[] }) => new Set(result.taskIds);

// One request per project; every card on the board shares it.
function useProjectRecurringTaskIds(projectId: string) {
  const { data } = useQuery({
    queryKey: ["task-recurrence", "project", projectId],
    queryFn: () => getProjectRecurringTaskIds(projectId),
    enabled: !!projectId,
    staleTime: 60_000,
    select: toSet,
  });
  return data;
}

export default useProjectRecurringTaskIds;
```

`apps/web/src/hooks/mutations/task-recurrence/use-set-task-recurrence.ts`:
```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import setTaskRecurrence from "@/fetchers/task-recurrence/set-task-recurrence";

export function useSetTaskRecurrence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, rrule, timeZone }: { taskId: string; projectId: string; rrule: string; timeZone: string }) =>
      setTaskRecurrence(taskId, { rrule, timeZone }),
    onSuccess: (recurrence, variables) => {
      queryClient.setQueryData(["task-recurrence", variables.taskId], { recurrence });
      queryClient.invalidateQueries({ queryKey: ["task-recurrence", "project", variables.projectId] });
    },
  });
}
```

`use-delete-task-recurrence.ts`:
```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteTaskRecurrence from "@/fetchers/task-recurrence/delete-task-recurrence";

export function useDeleteTaskRecurrence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId }: { taskId: string; projectId: string }) => deleteTaskRecurrence(taskId),
    onSuccess: (_result, variables) => {
      queryClient.setQueryData(["task-recurrence", variables.taskId], { recurrence: null });
      queryClient.invalidateQueries({ queryKey: ["task-recurrence", "project", variables.projectId] });
    },
  });
}
```

- [ ] **Step 7: Typecheck and commit**

```bash
pnpm run build:dependencies
pnpm --filter @kaneo/web typecheck
pnpm exec vp check --fix apps/web/src/lib/task-recurrence apps/web/src/fetchers/task-recurrence apps/web/src/hooks/queries/task-recurrence apps/web/src/hooks/mutations/task-recurrence
git add apps/web/src/lib/task-recurrence apps/web/src/fetchers/task-recurrence apps/web/src/hooks/queries/task-recurrence apps/web/src/hooks/mutations/task-recurrence
git commit -m "feat(web): add task recurrence helpers, fetchers and hooks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Expected: typecheck clean (the typed client picks up the new routes from Task 7).

---

### Task 9: Repeat UI

**Files:**
- Create: `apps/web/src/lib/task-recurrence/format-rule-summary.ts`, `apps/web/src/components/task/task-repeat-popover.tsx`, `apps/web/src/components/task/task-repeat-button.tsx`
- Modify: `i18n/en-US.json` (add `tasks.repeat`), `apps/web/src/components/task/task-properties-sidebar.tsx` (3 places), `apps/web/src/components/kanban-board/task-card.tsx`, `apps/web/src/hooks/use-project-websocket.ts`

**Interfaces:**
- Consumes: Task 8 helpers and hooks; `formatDate`, `formatDateShort` from `@/lib/format`; `toast` from `@/lib/toast`; `useWorkspacePermission`.
- Produces: `<TaskRepeatButton task={task} />` (sidebar row), `<TaskRepeatPopover task children />`, `formatRuleSummary(summary, t): string`.

- [ ] **Step 1: Add copy to `i18n/en-US.json`**

Inside the `"tasks"` object add:
```json
"repeat": {
  "none": "Doesn't repeat",
  "repeating": "Repeats",
  "frequency": "Repeat",
  "daily": "Daily",
  "weekly": "Weekly",
  "monthly": "Monthly",
  "yearly": "Yearly",
  "every": "Every",
  "unitDays": "day(s)",
  "unitWeeks": "week(s)",
  "unitMonths": "month(s)",
  "unitYears": "year(s)",
  "on": "On",
  "onDay": "On day {{day}}",
  "onWeekday": "On the {{ordinal}} {{weekday}}",
  "ordinal1": "first",
  "ordinal2": "second",
  "ordinal3": "third",
  "ordinal4": "fourth",
  "ordinalLast": "last",
  "next": "Next: {{date}}",
  "save": "Save",
  "stop": "Stop repeating",
  "saveSuccess": "Repeat updated",
  "saveError": "Failed to update repeat",
  "stopSuccess": "Task no longer repeats",
  "summaryDaily": "Every day",
  "summaryEveryDays": "Every {{n}} days",
  "summaryWeekly": "Weekly on {{days}}",
  "summaryEveryWeeks": "Every {{n}} weeks on {{days}}",
  "summaryMonthly": "Monthly on {{when}}",
  "summaryEveryMonths": "Every {{n}} months on {{when}}",
  "summaryYearly": "Yearly on {{date}}",
  "summaryEveryYears": "Every {{n}} years on {{date}}",
  "whenDay": "day {{day}}",
  "whenLastDay": "the last day",
  "whenWeekday": "the {{ordinal}} {{weekday}}"
}
```
Then run `pnpm i18n:check:fix` (copies the English strings into the other locale files), `pnpm i18n:schema` (regenerates the committed `i18n/schema.json`, which disallows unknown keys) and `pnpm i18n:check`. Expected: every locale prints `OK`.

- [ ] **Step 2: `format-rule-summary.ts`**

```ts
import type { TFunction } from "i18next";
import { formatDate } from "@/lib/format";
import { WEEKDAYS, type Weekday } from "./rule-form";
import type { RuleSummary } from "./summarize-rule";

// 5 Oct 2026 is a Monday, so index 0 lines up with WEEKDAYS.
export function weekdayName(weekday: Weekday, style: "short" | "long" | "narrow") {
  return formatDate(new Date(2026, 9, 5 + WEEKDAYS.indexOf(weekday)), { weekday: style });
}

export function ordinalLabel(ordinal: 1 | 2 | 3 | 4 | -1, t: TFunction) {
  return ordinal === -1 ? t("tasks:repeat.ordinalLast") : t(`tasks:repeat.ordinal${ordinal}`);
}

export function formatRuleSummary(summary: RuleSummary, t: TFunction) {
  const n = summary.interval;
  switch (summary.kind) {
    case "daily":
      return n === 1 ? t("tasks:repeat.summaryDaily") : t("tasks:repeat.summaryEveryDays", { n });
    case "weekly": {
      const days = summary.weekdays.map((day) => weekdayName(day, "short")).join(", ");
      return n === 1 ? t("tasks:repeat.summaryWeekly", { days }) : t("tasks:repeat.summaryEveryWeeks", { n, days });
    }
    case "monthly-day":
    case "monthly-weekday": {
      const when =
        summary.kind === "monthly-weekday"
          ? t("tasks:repeat.whenWeekday", { ordinal: ordinalLabel(summary.ordinal, t), weekday: weekdayName(summary.weekday, "long") })
          : summary.day === -1
            ? t("tasks:repeat.whenLastDay")
            : t("tasks:repeat.whenDay", { day: summary.day });
      return n === 1 ? t("tasks:repeat.summaryMonthly", { when }) : t("tasks:repeat.summaryEveryMonths", { n, when });
    }
    case "yearly": {
      const date = formatDate(new Date(2028, summary.month - 1, summary.day), { month: "short", day: "numeric" });
      return n === 1 ? t("tasks:repeat.summaryYearly", { date }) : t("tasks:repeat.summaryEveryYears", { n, date });
    }
  }
}
```

- [ ] **Step 3: `task-repeat-popover.tsx`**

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDeleteTaskRecurrence } from "@/hooks/mutations/task-recurrence/use-delete-task-recurrence";
import { useSetTaskRecurrence } from "@/hooks/mutations/task-recurrence/use-set-task-recurrence";
import useGetTaskRecurrence from "@/hooks/queries/task-recurrence/use-get-task-recurrence";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatDateShort } from "@/lib/format";
import { ordinalLabel, weekdayName } from "@/lib/task-recurrence/format-rule-summary";
import {
  defaultForm,
  FREQUENCIES,
  type Frequency,
  formToRrule,
  type MonthlyMode,
  monthlyOptions,
  type RepeatForm,
  rruleToForm,
  WEEKDAYS,
  weekdayOf,
  weekOfMonth,
} from "@/lib/task-recurrence/rule-form";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

const FREQUENCY_KEYS: Record<Frequency, string> = {
  DAILY: "tasks:repeat.daily",
  WEEKLY: "tasks:repeat.weekly",
  MONTHLY: "tasks:repeat.monthly",
  YEARLY: "tasks:repeat.yearly",
};

const UNIT_KEYS: Record<Frequency, string> = {
  DAILY: "tasks:repeat.unitDays",
  WEEKLY: "tasks:repeat.unitWeeks",
  MONTHLY: "tasks:repeat.unitMonths",
  YEARLY: "tasks:repeat.unitYears",
};

type TaskRepeatPopoverProps = {
  task: Task;
  children: React.ReactNode;
};

export default function TaskRepeatPopover({ task, children }: TaskRepeatPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { canUpdateTasks } = useWorkspacePermission();
  const { data } = useGetTaskRecurrence(task.id);
  const recurrence = data?.recurrence ?? null;
  const reference = task.dueDate ? new Date(task.dueDate) : new Date();
  const [form, setForm] = useState<RepeatForm>(() => defaultForm(reference));
  const { mutateAsync: saveRecurrence, isPending: isSaving } = useSetTaskRecurrence();
  const { mutateAsync: stopRecurrence, isPending: isStopping } = useDeleteTaskRecurrence();

  if (!canUpdateTasks()) return <>{children}</>;

  const handleOpenChange = (next: boolean) => {
    if (next) setForm(recurrence ? rruleToForm(recurrence.rrule, reference) : defaultForm(reference));
    setOpen(next);
  };

  const monthlyLabel = (mode: MonthlyMode) =>
    mode === "day"
      ? t("tasks:repeat.onDay", { day: reference.getDate() })
      : t("tasks:repeat.onWeekday", {
          ordinal: ordinalLabel(mode === "weekday" ? (weekOfMonth(reference) as 1 | 2 | 3 | 4) : -1, t),
          weekday: weekdayName(weekdayOf(reference), "long"),
        });

  const canSave =
    Number.isInteger(form.interval) &&
    form.interval >= 1 &&
    form.interval <= 365 &&
    (form.frequency !== "WEEKLY" || form.weekdays.length > 0);

  const handleSave = async () => {
    try {
      await saveRecurrence({
        taskId: task.id,
        projectId: task.projectId,
        rrule: formToRrule(form, reference),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      toast.success(t("tasks:repeat.saveSuccess"));
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("tasks:repeat.saveError"));
    }
  };

  const handleStop = async () => {
    try {
      await stopRecurrence({ taskId: task.id, projectId: task.projectId });
      toast.success(t("tasks:repeat.stopSuccess"));
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("tasks:repeat.saveError"));
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        <div className="space-y-1.5">
          <Label>{t("tasks:repeat.frequency")}</Label>
          <Select
            value={form.frequency}
            onValueChange={(value) => setForm((current) => ({ ...current, frequency: value as Frequency }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{t(FREQUENCY_KEYS[form.frequency])}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {FREQUENCIES.map((frequency) => (
                <SelectItem key={frequency} value={frequency}>
                  {t(FREQUENCY_KEYS[frequency])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor={`repeat-interval-${task.id}`}>{t("tasks:repeat.every")}</Label>
          <Input
            id={`repeat-interval-${task.id}`}
            type="number"
            min={1}
            max={365}
            className="w-20"
            value={form.interval}
            onChange={(event) => setForm((current) => ({ ...current, interval: Number(event.target.value) }))}
          />
          <span className="text-sm text-muted-foreground">{t(UNIT_KEYS[form.frequency])}</span>
        </div>

        {form.frequency === "WEEKLY" && (
          <div className="flex gap-1" role="group" aria-label={t("tasks:repeat.on")}>
            {WEEKDAYS.map((day) => {
              const selected = form.weekdays.includes(day);
              return (
                <Button
                  key={day}
                  type="button"
                  size="sm"
                  variant={selected ? "default" : "outline"}
                  className="h-7 w-7 p-0 text-xs"
                  aria-pressed={selected}
                  aria-label={weekdayName(day, "long")}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      weekdays: selected ? current.weekdays.filter((entry) => entry !== day) : [...current.weekdays, day],
                    }))
                  }
                >
                  {weekdayName(day, "narrow")}
                </Button>
              );
            })}
          </div>
        )}

        {form.frequency === "MONTHLY" && (
          <Select
            value={form.monthlyMode}
            onValueChange={(value) => setForm((current) => ({ ...current, monthlyMode: value as MonthlyMode }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{monthlyLabel(form.monthlyMode)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {monthlyOptions(reference).map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {monthlyLabel(mode)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {recurrence && (
          <p className="text-xs text-muted-foreground">
            {t("tasks:repeat.next", { date: formatDateShort(recurrence.nextDueDate) })}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
          {recurrence ? (
            <Button variant="ghost" size="sm" onClick={handleStop} disabled={isStopping}>
              {t("tasks:repeat.stop")}
            </Button>
          ) : (
            <span />
          )}
          <Button size="sm" onClick={handleSave} disabled={!canSave || isSaving}>
            {t("tasks:repeat.save")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: `task-repeat-button.tsx`**

```tsx
import { Repeat } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import useGetTaskRecurrence from "@/hooks/queries/task-recurrence/use-get-task-recurrence";
import { formatRuleSummary } from "@/lib/task-recurrence/format-rule-summary";
import { summarizeRule } from "@/lib/task-recurrence/summarize-rule";
import type Task from "@/types/task";
import TaskRepeatPopover from "./task-repeat-popover";

export default function TaskRepeatButton({ task }: { task: Task }) {
  const { t } = useTranslation();
  const { data } = useGetTaskRecurrence(task.id);
  const rrule = data?.recurrence?.rrule;

  return (
    <TaskRepeatPopover task={task}>
      <Button variant="ghost" size="sm" className="justify-start h-7 px-1.5 gap-1.5">
        <Repeat className="w-3.5 h-3.5 text-muted-foreground" />
        <span className={`text-xs font-semibold ${rrule ? "" : "text-muted-foreground"}`}>
          {rrule ? formatRuleSummary(summarizeRule(rrule), t) : t("tasks:repeat.none")}
        </span>
      </Button>
    </TaskRepeatPopover>
  );
}
```

- [ ] **Step 5: Sidebar, board card, websocket**

`task-properties-sidebar.tsx`: add `import TaskRepeatButton from "./task-repeat-button";` after the `TaskPriorityPopover` import. Directly after each of the three `</TaskDueDatePopover>` blocks' closing `)}`, add:
```tsx
              {task && <TaskRepeatButton task={task} />}
```
(match the surrounding indentation at each of the three sites; verify with `grep -c "TaskRepeatButton task" apps/web/src/components/task/task-properties-sidebar.tsx` → `3`).

`kanban-board/task-card.tsx`: add `Repeat,` to the `lucide-react` import, `import useProjectRecurringTaskIds from "@/hooks/queries/task-recurrence/use-project-recurring-task-ids";` to the imports, `const recurringTaskIds = useProjectRecurringTaskIds(task.projectId);` next to the component's other hooks, and directly after the due-date block (`{showDueDates && task.dueDate && ( … )}`):
```tsx
              {recurringTaskIds?.has(task.id) && (
                <div
                  className="flex items-center rounded h-5.5 px-1.5 text-muted-foreground"
                  title={t("tasks:repeat.repeating")}
                >
                  <Repeat className="w-3 h-3" aria-label={t("tasks:repeat.repeating")} />
                </div>
              )}
```

`hooks/use-project-websocket.ts`: immediately before the `if (message.type === "TASK_UPDATED" || message.type === "TASK_CREATED" ||` condition, add:
```ts
          if (message.type === "TASK_CREATED") {
            // A completed repeating task hands its rule to the new copy.
            void queryClient.invalidateQueries({
              queryKey: ["task-recurrence", "project", projectId],
            });
          }
```

- [ ] **Step 6: Verify and commit**

```bash
pnpm --filter @kaneo/web typecheck
pnpm --filter @kaneo/web exec vp test run --config vitest.config.ts
pnpm i18n:check
pnpm exec vp check --fix apps/web/src i18n
git add apps/web/src i18n
git commit -m "feat(web): add Repeat control and board indicator

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Expected: typecheck clean, all web tests PASS, i18n check passes.

---

### Task 10: Build the custom image and test it in a browser

**Files:**
- Create: `UPDATING.md`
- No product code changes.

- [ ] **Step 1: Full checks**

```bash
pnpm lint
pnpm typecheck
pnpm --filter @kaneo/api exec vp test run --config vitest.config.ts
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/kaneo_test pnpm --filter @kaneo/api exec vp test run --config vitest.integration.config.ts
pnpm --filter @kaneo/web exec vp test run --config vitest.config.ts
```
Expected: all pass. If a test unrelated to this feature fails, check whether it also fails on unmodified upstream code (`git worktree add ../kaneo-upstream upstream/main`, run the same command there, then `git worktree remove ../kaneo-upstream`). Report it either way; only a failure caused by this branch blocks the build.

- [ ] **Step 2: Build the image**

```bash
docker build -f Dockerfile.kaneo -t kaneo-custom:latest .
```
Expected: build succeeds.

- [ ] **Step 3: Run a throwaway instance (empty DB, separate ports)**

```bash
mkdir -p ../kaneo-trial && cd ../kaneo-trial
cat > compose.yml <<'EOF'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: kaneo
      POSTGRES_USER: kaneo
      POSTGRES_PASSWORD: trial-only-password
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kaneo -d kaneo"]
      interval: 5s
      retries: 10
  kaneo:
    image: kaneo-custom:latest
    ports:
      - "5180:5173"
    environment:
      KANEO_CLIENT_URL: http://localhost:5180
      POSTGRES_HOST: postgres
      POSTGRES_DB: kaneo
      POSTGRES_USER: kaneo
      POSTGRES_PASSWORD: trial-only-password
      AUTH_SECRET: trial-only-secret-with-at-least-32-characters
    depends_on:
      postgres:
        condition: service_healthy
EOF
docker compose -p kaneo-trial up -d
```
Wait for `curl -s http://localhost:5180/api/health` → `{"status":"ok"}`.

- [ ] **Step 4: Click through in a browser (Claude in Chrome or Playwright)**

At http://localhost:5180: sign up a throwaway account, create a workspace and project, create a task with a due date and one subtask. Open the task → Repeat row shows "Doesn't repeat" → set Weekly on two days → Save → row shows the summary and "Next:" date; board card shows the repeat icon. Move the task to Done → a new copy appears in the first column with the next date, its subtask copy, and the repeat icon; the old task stays in Done without the icon. Move the old task out of Done and back → no new copy. On the copy: Stop repeating → icon disappears. Capture a GIF of the flow (`recurring_tasks_trial.gif`).

- [ ] **Step 5: Tear down the trial**

```bash
docker compose -p kaneo-trial down -v
cd ../kaneo-source
```
(`-v` is correct here: it deletes only the throwaway trial database.)

- [ ] **Step 6: Write `UPDATING.md` and commit**

````markdown
# Updating this fork

This fork (soniaginzb/kaneo, branch `recurring-tasks`) adds recurring tasks. It is never sent upstream: `upstream` is fetch-only.

1. Back up the live database:
   `cd ../kaneo && docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > backups/kaneo-$(date +%Y%m%d-%H%M%S).dump`
2. `cd ../kaneo-source && git fetch upstream && git switch recurring-tasks && git merge upstream/main`
3. If `apps/api/drizzle` conflicts (upstream added a migration with our number): take upstream's versions of every conflicting file under `apps/api/drizzle`, delete our `*_task_recurrence.sql` and its snapshot, run `pnpm install`, then `cd apps/api && DATABASE_URL=postgresql://postgres:postgres@localhost:5434/kaneo_test pnpm exec drizzle-kit generate --name task_recurrence` and re-apply the idempotent edit from Task 4 Step 4 of the plan. The live database will run the regenerated file once more; because it uses `IF NOT EXISTS` and a guarded constraint, that is a no-op.
4. Run the checks from Task 10 Step 1 of `docs/superpowers/plans/2026-10-01-recurring-tasks.md`.
5. `docker build -f Dockerfile.kaneo -t kaneo-custom:latest .`, then `cd ../kaneo && docker compose up -d`.
6. `git push origin recurring-tasks` (origin = the fork).
````

```bash
git add UPDATING.md
git commit -m "docs: add fork update guide

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Switch the live instance

**Files:**
- Modify: `C:\Users\Admin\Documents\work\kaneo\compose.yml` (image line only)

- [ ] **Step 1: Back up and record a snapshot**

```bash
cd /c/Users/Admin/Documents/work/kaneo
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "backups/kaneo-2.29.3-$(date +%Y%m%d-%H%M%S).dump"
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "select (select count(*) from workspace),(select count(*) from project),(select count(*) from task),(select count(*) from label);"'
```
Expected: dump file > 0 bytes; counts recorded (last known: `1|4|3|1`).

- [ ] **Step 2: Switch the image**

In `compose.yml`, change `image: ghcr.io/usekaneo/kaneo:latest` to `image: kaneo-custom:latest`. Then:
```bash
docker compose up -d
```
Wait until `docker inspect -f '{{.State.Health.Status}}' kaneo-kaneo-1` is `healthy`, and check `docker compose logs kaneo --since 5m` shows `Database migrated successfully` and no errors.

- [ ] **Step 3: Verify the live data**

Re-run the counts query from Step 1 — identical. Check the new table exists and is empty:
```bash
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "select count(*) from task_recurrence;"'
```
Expected: `0`. Open http://localhost:5173, confirm CNT-4 "write one typeshare post a day" is present with a "Doesn't repeat" Repeat row. Do not set a rule on real tasks — that is the user's call.

- [ ] **Step 4: Push the branch to the fork**

```bash
cd /c/Users/Admin/Documents/work/kaneo-source
git push -u origin recurring-tasks
```
Expected: pushed to `soniaginzb/kaneo` only. Do not open a pull request.

- [ ] **Step 5: Clean up**

```bash
docker rm -f kaneo-test-db
```

Rollback, if anything is wrong: set the image back to `ghcr.io/usekaneo/kaneo:latest`, `docker compose up -d`. The extra `task_recurrence` table is ignored by the official image.
