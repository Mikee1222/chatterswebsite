# VA Tasks

VA Tasks is one of the most complex subsystems. It combines Airtable-backed task records, **virtual day projection** for recurring series, **real-row spawning** on shift start / day boundary, and multi-phase checklists.

## Overview

| | |
|--|--|
| **Routes** | `/va-tasks` (VA personal), `/admin/va-tasks` (admin board + Progress Overview), `/admin/task-templates` |
| **Permissions** | `va-tasks:view`, `va-tasks:manage`, `va-tasks:assign`, `task_progress:view`, `task_templates:manage` |
| **Actions** | `app/actions/va-tasks.ts` |
| **Services** | `services/va-tasks.ts`, `services/va-task-recurring-spawn.ts`, `services/task-phases.ts`, `services/task-templates.ts` |
| **Components** | `components/va-tasks-client.tsx`, `components/admin-va-tasks-client.tsx`, `components/va-task-card.tsx` |
| **Tables** | `va_tasks`, `va_task_phases`, `va_task_phase_items`, `task_templates`, `task_template_phases`, `task_template_items` |

---

## Data model (`va_tasks`)

Key fields (see `services/va-tasks.ts` `Fields` type):

| Field | Notes |
|-------|-------|
| `title`, `description` | Task content |
| `assigned_to` | Linked to `users` — **formulas use `user_id` slug, not `rec…`** |
| `assigned_by` | Linked to `users` |
| `assigned_model_ids` | Comma-separated model slugs |
| `status` | `pending`, `in_progress`, `done`, `skipped` |
| `priority` | `low`, `normal`, `high`, `urgent` |
| `due_date` | DateTime — ISO UTC with ms (`2026-05-03T12:30:00.000Z`) |
| `is_recurring` | Boolean |
| `recurrence_type` | `daily`, `weekly`, `monthly`, `custom` |
| `recurrence_days` | Weekday names for weekly |
| `recurrence_interval` | Integer multiplier |
| `recurrence_end_date` | Date-only `YYYY-MM-DD` or empty = indefinite |
| `reminder_minutes_before` | Push reminder offset |
| `completed_at`, `completed_notes` | Completion metadata |

### Phases

Tasks can have checklist phases:

- `va_task_phases` — phase headers linked to task
- `va_task_phase_items` — individual checklist items

Clone on spawn: `clonePhasesToTask(sourceId, targetTask)` in `services/task-phases.ts`.

---

## Virtual projection (display-only occurrences)

Recurring tasks do **not** pre-create infinite Airtable rows. Instead, the UI **projects** virtual occurrences for calendar days that don't yet have a real row.

### Core functions

| Function | File | Purpose |
|----------|------|---------|
| `expandTasksForAthensYmd()` | `lib/va-task-date-filter.ts` | Adds virtual rows for a target Athens day |
| `materializeVirtualOccurrence()` | `lib/recurrence.ts` | Builds virtual `VaTaskRecord` |
| `filterTasksByAthensYmd()` | `lib/va-task-date-filter.ts` | Date filter + expansion |
| `selectVaTasksForDateView()` | `lib/va-task-date-filter.ts` | Used by List + Progress Overview |

### Virtual task identity

```typescript
id: `virt_${source.id}_${ymd}`   // e.g. virt_recABC_2026-07-29
is_virtual_occurrence: true
virtual_source_task_id: source.id
status: "pending"  // always pending for display
```

Virtual tasks:

- Appear in date-scoped views (today, tomorrow, date picker)
- **Cannot be deleted** — `deleteVaTask` throws for virtual IDs
- Completing a virtual task **materializes** a real row first (via server action)

### Series key

`vaTaskSeriesKey(task)` = `title + assignees + models` (sorted, null-delimited). Used for de-dupe across projection, spawn, and cleanup scripts.

### Admin fetch formula

`buildGetAllVaTasksFormula()` in `lib/va-tasks-airtable-formula.ts` unions date-scoped rows **plus all** `{is_recurring} = TRUE()` rows — required so anchors exist for virtual projection in List / Progress views.

---

## Recurring spawn (real Airtable rows)

Virtual rows are previews. **Real rows** are created only for **today (Athens)** via:

| Trigger | Function | File |
|---------|----------|------|
| VA starts task shift | `spawnTodayRecurringOccurrencesForVa(vaId)` | `services/va-task-recurring-spawn.ts` |
| Day-boundary cron | `spawnTodayRecurringOccurrencesAll()` | same |
| Complete overdue task where next occurrence is today | `spawnNextRecurringOccurrenceAfterComplete()` | same |

### Spawn rules

1. **Only today's Athens YMD** — future days stay virtual until their calendar day
2. In-process mutex (`spawnLocks` Map) prevents duplicate creates from concurrent shift-start + cron
3. Re-check Airtable immediately before insert (race closure)
4. Clone phases from best source row in series (most checklist items)
5. Backfill phases if shell row exists without items

### Cron integration

Check `services/cron-notification-jobs.ts` and API cron routes for calls to spawn + overdue reminder jobs.

---

## Athens timezone

All VA task date navigation uses **Europe/Athens** calendar days:

```typescript
getVaTasksViewTodayYmd()  // → ymdInAthens(new Date().toISOString())
taskMatchesAthensYmd(task, ymd)
```

**Do not** use `new Date().toISOString().slice(0,10)` for task bucketing — that is UTC, not Athens.

See `lib/airtable-datetime.ts` for helpers. Note the dual approach: `ymdInAthens` uses IANA timezone; `getNowInAthens` uses fixed UTC+3 offset for week-start helpers.

---

## Client UI patterns

### `fetchSeqRef` (stale response guard)

Both `components/va-tasks-client.tsx` and `components/model-home-client.tsx` use:

```typescript
const fetchSeqRef = React.useRef(0);
const seq = ++fetchSeqRef.current;
// ... await fetch ...
if (seq !== fetchSeqRef.current) return; // discard stale
```

When adding client refetch logic, preserve this pattern to avoid state desync after rapid date changes or filter toggles.

### Virtual task interactions

- Complete/skip on virtual → server materializes real row, then updates
- Admin card shows "virtual" badge when `is_virtual_occurrence || id.startsWith("virt_")`

---

## Task templates

Admin creates reusable templates at `/admin/task-templates` (`task_templates:manage`).

| Table | Purpose |
|-------|---------|
| `task_templates` | Template metadata |
| `task_template_phases` | Phase structure |
| `task_template_items` | Checklist items |

Applying a template to a new task copies phases into `va_task_phases` / `va_task_phase_items`.

---

## VA Statistics

| | |
|--|--|
| **Route** | `/admin/va-statistics` |
| **Permission** | `va_statistics:view` |
| **Service** | `services/va-statistics.ts`, `services/va-statistics-weekly-cron.ts` |

Weekly summary notifications (`va_statistics_weekly_summary`). Late/no-show inferred partly from `notifications` table, not shift columns.

---

## Model schedule sync

Creating/updating a VA task also syncs to `model_schedule` table via `createModelScheduleItemsForVaTask()` in `services/model-schedule.ts` — failures are logged but don't block task create.

---

## Audit / maintenance scripts

| Script | Purpose |
|--------|---------|
| `scripts/verify-recurring-spawn-fix.ts` | Regression check for spawn + virtual counts |
| `scripts/audit-recurring-over-spawn.ts` | Detect duplicate real rows per series/day |
| `scripts/cleanup-duplicate-recurring-tasks.ts` | Remove duplicate spawned rows |
| `scripts/audit-virtual-preview-fresh.ts` | Trace projection for new daily task |
| `scripts/test-va-tasks-regression.ts` | Broader regression suite |

Run with `npx tsx scripts/<name>.ts` (requires `.env` with Airtable creds).

---

## Gotchas summary

1. **`assigned_to` formulas** — use `user_id` in Airtable formulas, not record id
2. **Virtual vs real** — never call Airtable delete/update with `virt_*` ids
3. **Spawn is today-only** — don't expect real rows for future dates
4. **Series key includes models** — same title, different models = different series
5. **`due_date` wire format** — must include ms and `Z` suffix for Airtable dateTime
6. **Progress Overview** — requires `task_progress:view` or inherits from `va-tasks:manage`
7. **revalidatePath** after mutations: admin VA tasks, personal VA tasks, VA home, VA schedule

---

## Related

- [shifts-and-programs.md](./shifts-and-programs.md) — shift start triggers spawn
- [05-bug-patterns.md](../05-bug-patterns.md) — timezone, rec vs slug, state desync
