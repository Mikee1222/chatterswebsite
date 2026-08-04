# Post-cutover performance audit (Production Supabase)

**Date:** 2026-08-04  
**Project:** `wagfkuxkrgsencartqtx`  
**Scope:** Live app after `DATA_BACKEND=supabase` cutover — identify slow routes, fix clear wins.

## Method

- Vercel production logs (last ~6–12h): path frequency; `/admin/va-statistics` confirmed hot.
- Supabase advisors (`get_advisors` performance): 7 unindexed FKs; many unused indexes (left alone).
- `EXPLAIN ANALYZE` on VA Statistics punctuality query.
- Code review of `services/*-supabase.ts` full-table `sbSelectAll` + in-memory filters.
- Local PostgREST + `computeVaStatisticsReport` timings against Production DB (service role).

## Slowest routes / root causes

| Route / path | Symptom | Root cause |
|---|---|---|
| `/admin/va-statistics` + `/api/admin/va-statistics` | ~30s reported in production | Full paginated scan of **notifications** (~25.6k rows, ~26×1k pages) for punctuality; full scan of **va_task_phase_items** (~3.4k); shifts loaded all-then-filter; sequential await after tasks |
| Shift / live-shift model joins | Extra latency under load | `listShiftModelsForShifts` / `getChatterIdsFromOpenShiftModels` scanned all **shift_models** (~3.9k) |
| Many admin pages | Moderate | Still `listAllModelss` / `listAllUsers` per request — **tiny** on Supabase (14 / 35 rows); cache already used on heaviest pages |

Vercel request logs in this environment do not expose function duration in the JSON stream; timings below are from DB EXPLAIN + local scripts hitting Production PostgREST / service layer.

## Database findings

### Before (punctuality query)

```text
Seq Scan on notifications … actual time=…1555 ms … Rows Removed by Filter: 25487
```

### After index `idx_notifications_event_created`

```text
Index Scan using idx_notifications_event_created … actual time=0.175..0.582 ms (99 rows)
Execution Time: 0.666 ms
```

(~**1555 ms → 0.7 ms** at the planner/executor layer for the filtered month window.)

### Indexes added (`20260804010000_perf_audit_indexes.sql`, applied to Production)

- `idx_notifications_event_created` `(event_type, created_at DESC)`
- `idx_shifts_date_staff_role` `(date, staff_role)`
- `idx_shift_models_shift_gin` GIN `(shift)` for overlap filters
- Unindexed FK covering indexes: `client_model_assignments.model_id`, `custom_request_assignees.user_id`, `shift_model_links.model_id`, `sop_role_users.user_id`, `va_content_assignment_vas.user_id`, `va_task_assignees.user_id`, `va_task_models.model_id`

Prior Sprint indexes (`20260804000001_realtime_and_perf_indexes.sql`) already covered most status/date FKs on notifications user paths, va_tasks, shifts, etc.

## Application fixes (this pass)

1. **`va-statistics-supabase.ts`** — filter phase items with `task_id IN (…)`; filter notifications by `event_type IN` + `created_at` range (Athens-padded), not full table.
2. **`va-statistics.ts`** — fetch tasks, punctuality, and shifts in parallel.
3. **`shifts-supabase.ts`** — push date / staff_role / active status filters into PostgREST via new `sbSelectWhere`; `listShiftModelsForShifts` uses UUID resolve + `overlaps(shift, …)`; `getChatterIdsFromOpenShiftModels` filters by model UUID.
4. **`lib/supabase-data.ts`** — added `sbSelectWhere` (paginated filtered select).

## Before / after timings

### Query patterns (PostgREST, Production)

| Query | Before (full scan) | After (filtered) |
|---|---|---|
| Notifications (punctuality columns) | **~4234 ms** (25 586 rows) | **~129 ms** (event+date filter) |
| `va_task_phase_items` | **~637 ms** (3449 rows) | **~302 ms** (`IN` task ids → 1552 rows) |
| Shifts date+VA role | **~359 ms** (721 rows) | **~175 ms** (23 rows) |
| `shift_models` full list | **~512 ms** (3928 rows) | Avoided on per-shift join path |

### End-to-end `computeVaStatisticsReport` (local → Production Supabase)

| Preset | After fix |
|---|---|
| `this_week` | **~1.1 s** |
| `this_month` | **~0.8 s** |

**Production UX estimate:** VA Statistics **~30 s → ~1–3 s** (dominated previously by ~26 notification page round-trips). Re-measure in Vercel after deploy for confirmation.

## Confirmed already good (no regression)

- **Priority 5 N+1 “medium” list** — batch-then-map landed in `dc2e3f1` (shifts batch writes, SOPs, model-*, whales, marketing, weekly-availability, etc.). Coalesce/chunk ID helpers remain.
- **Caching** — `getCachedModelss` (60s), `getCachedActiveUsers` (Airtable path), shift-page model cache, billing client caches still present. Several pages still call `listAllModelss`/`listAllUsers` directly; impact is low with Supabase row counts.
- **Recharts** — still `next/dynamic` code-split on admin home, earnings, link-pages, VA statistics client.
- **Realtime** — single hook subscribes to broadcast + optional `postgres_changes` (intentional dual transport, not overlapping duplicate table channels per purpose). No change.

## Deferred

| Item | Why deferred |
|---|---|
| Drop unused indexes (advisor lists ~90) | Risk of false “unused” early after cutover; revisit after weeks of stats |
| `CONCURRENTLY` indexes | Supabase `apply_migration` runs in a transaction — used non-concurrent `IF NOT EXISTS` (safe; brief write locks on small/medium tables) |
| `/admin/model-schedules` resolveWeekHref | Owned by another agent — untouched |
| Client-portal partnership analytics still loads all billing cycles | Functional; optimize when billing pages are profiled |
| Dual broadcast + postgres realtime | By design for JWT-optional fallback |
| Remaining full-table `sbSelectAll` on tiny lookup tables (SOPs, prizes, tiers, users/modelss lists, etc.) | Tables are small; convert when a route shows pain |
| `listAllWhales` / `listAllWeeklyProgram` full dumps | Still used by account-delete and cron; week/chatter paths are filtered |

## Follow-up completed (low-priority items)

**Date:** 2026-08-04 (same day)

### 1. `getCachedModelss` on remaining pages

Switched dropdown/reference/display call sites from `listAllModelss()` → `getCachedModelss()` (60s `unstable_cache`):

- Dashboard layout quick-stats, shift page (shared cache; dropped duplicate shift-only cache)
- Admin: marketing, accounts, link-pages, custom-requests, expense-requests, model-content-requests, model-schedules
- Accounts create/edit, free-modelss, fines-bonuses (cache + filter `status === "active"`)
- VA: schedule, custom-requests, whales; chatter weekly-program / va-weekly-program / my-whales
- `lib/schedule-overview-page-data.ts`

**Left uncached (intentional):** API/webhook/cron/sync paths that need formula filters or immediate freshness after mutations (`api/admin/models`, search, OF webhook/sync, period notifications, client-billing, task-templates). Client `custom-request-history.tsx` cannot use `unstable_cache`.

### 2. Remaining `sbSelectAll` → filtered queries

| File | Table | Before | After |
|---|---|---|---|
| `weekly-program-supabase.ts` `getProgramsForWeek*` | `weekly_program` (475 rows) | Full scan ~**8.2 ms** / 475 rows | `week_start` (+ optional chatter contains) ~**0.9 ms** / ~19 rows |
| `weekly-program-va-supabase.ts` | `weekly_program_va` (17) | Full table then filter | Same `week_start` / chatter pattern |
| `weekly-availability-requests(-va/-models)-supabase.ts` | avail tables (406 / 46 / 1) | Full scan ~**13 ms** / 406 | `week_start` (+ chatter) → ~3 rows typical week |
| `whales-supabase.ts` paginated / by-chatter / unassigned count | `whales` (38) | Always load all 38 | PostgREST `eq`/`ilike`/`contains`/`or` empty array |
| `whale-transactions-supabase.ts` `listTransactionsByChatter` | `whale_transactions` (3) | Full list then filter | `contains(chatter, …)` |
| `whale-activity-supabase.ts` | `whale_activity` (0) | Full table | `eq(whale_id)` + order |

`listAllWhales` / `listAllWeeklyProgram` / `listAllWeeklyProgramVa` remain full-table for account-delete + cron dump callers.

## Test

- `npx tsc --noEmit` — pass after changes.
- Local: `npx tsx scripts/_perf-va-report.ts` (requires `.env.local` + `ws` polyfill).

## Deploy notes

- Commit ships app query fixes + migration file.
- Indexes already applied to Production via Supabase MCP `apply_migration` (`perf_audit_indexes`).
- Push to `main` for Vercel Production; sync `supabase-preview-test` if Preview should match.
