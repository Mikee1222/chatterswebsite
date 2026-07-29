# Shifts & Weekly Programs

## Chatting shifts

Chatters start/end **chatting shifts** and enter/leave models during active shifts.

| | |
|--|--|
| **Routes** | `/shift` (chatter), `/admin/live-shifts`, `/admin/shift-activity`, `/active-shifts` |
| **Actions** | `app/actions/shift.ts`, `app/actions/shifts.ts`, `app/actions/model-session.ts` |
| **Services** | `services/shifts.ts`, `services/shift-queue.ts`, `services/check-late-shifts.ts`, `services/check-break-reminders.ts` |
| **Tables** | `shifts`, `shift_models`, `shift_queue`, `modelss` |

### Shift types

From `types/index.ts`: `ShiftType` includes `chatting`, `mistakes`, `vault_cleaning`, `other`, `task`, `va_tasks`.

- Chatting shifts link to models via `shift_models`
- VA **task shifts** are separate — see VA task shift below

### Shift queue

When models are occupied, chatters can join a **shift queue** (`shift_queue` table):

- Status: `waiting`, `started`, `cancelled`, `expired`
- Types: `full_start`, `add_models`

### Cron / notifications

- `workers/cron-late-shifts/` — Cloudflare Worker for late shift detection
- `services/check-late-shifts.ts` — creates `shift_late`, `shift_no_show` notifications
- `services/check-break-reminders.ts` — break exceeded alerts

### Gotchas

- **`resolveShiftChatterRecordId`** — maps `user_id` slug ↔ Airtable `rec…` id for shift ownership. Formulas on linked fields often return `user_id`, not record id.
- Active shift queries filter by status (`active`, `on_break`) — stale rows with wrong status block new shifts.
- `revalidatePath` after shift mutations must include chatter home, shift page, and admin live shifts.

---

## Weekly program (chatters)

| | |
|--|--|
| **Routes** | `/weekly-program` (chatter), `/admin/weekly-program` |
| **Permissions** | `chatter_program:view`, `chatter_program:manage` |
| **Actions** | `app/actions/weekly-program.ts` |
| **Services** | `services/weekly-program.ts`, `services/weekly-program-publish-notify.ts` |
| **Table** | `weekly_program` |

### Schema highlights

- `week_start` — Monday of the week (normalized via `airtableWeekStartToMonday`)
- `chatter` — linked to `users`
- `models` — linked to `modelss`
- `day` — Monday–Sunday
- `shift_type` — Morning/Afternoon/Night (see `WEEKLY_PROGRAM_SHIFT_TYPES`)
- `start_time` / `end_time` — stored as Airtable-compatible time/datetime strings

### Conflict detection

`lib/weekly-program-conflicts.ts` — overlap checks when assigning models across chatters.

### Gotchas

- Field name **`week_start`** is case-sensitive in Airtable formulas — use constant `WEEK_START_FIELD`.
- Legacy permission `weekly-program:view/manage` auto-expands to chatter + VA program permissions in `lib/rbac.ts`.
- Publish notifications fire via `weekly-program-publish-notify.ts` when admin publishes a week.

---

## Weekly program (VAs)

| | |
|--|--|
| **Routes** | `/va/schedule`, `/admin/weekly-program-va`, `/va/weekly-program` |
| **Permissions** | `va_program:view` (all VAs by default), `va_program:manage` |
| **Actions** | `app/actions/weekly-program-va.ts` |
| **Services** | `services/weekly-program-va.ts` |
| **Table** | `weekly_program_va` |

Parallel structure to chatter weekly program but for VA staff schedules.

---

## Weekly availability

Models and VAs submit weekly availability windows.

| Actor | Routes | Table |
|-------|--------|-------|
| Chatter | `/weekly-availability` | `weekly_availability_requests` |
| VA | `/va/weekly-availability` | `weekly_availability_requests_va` |
| Model | `/model/availability`, `/model/schedule` | `weekly_availability_requests_models` |

**Actions:** `app/actions/weekly-availability*.ts`  
**Services:** `services/weekly-availability-requests*.ts`

Friday reminder cron: `weekly_availability_friday_reminder` notification event.

### Model availability windows

Admin manages model availability at `/admin/model-availability` (`models:availability`). Uses `modelss` availability window fields — see `scripts/add-model-availability-windows-field.ts`.

---

## VA task shift

VAs start a **task shift** (`va_tasks` shift type) to work through phased checklists.

| | |
|--|--|
| **Route** | `/va-shift`, `/task-shifts` |
| **Service** | `services/shifts.ts`, `services/va-task-recurring-spawn.ts` |
| **Trigger** | `spawnTodayRecurringOccurrencesForVa()` on shift start |

When a VA starts a task shift, today's recurring VA task rows are materialized in Airtable (see [va-tasks.md](./va-tasks.md)).

---

## Hours summary

| | |
|--|--|
| **Route** | `/hours` |
| **Service** | `services/hours.ts` |
| **Table** | `staff_hours_summary` (optional cache) |

Aggregates shift duration from `shifts` table.

---

## Related

- [va-tasks.md](./va-tasks.md) — recurring spawn on shift start
- [models-and-content.md](./models-and-content.md) — model schedules overview
