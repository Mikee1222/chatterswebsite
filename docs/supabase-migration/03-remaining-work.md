# Remaining work — Supabase Migration

## Status: ✅ FULL DUAL-BACKEND COVERAGE

Every Airtable-backed CRUD service in `services/` now has an `isSupabaseBackend()`
guard that dispatches to a `*-supabase.ts` twin (or an inline branch when the
Airtable/Supabase paths are small enough to co-locate).

**`DATA_BACKEND` default remains `"airtable"`.** Flipping the flag to `"supabase"`
routes reads and writes to the Postgres implementation across the board.

---

## Phase 2 — Data migration

- ✅ Reusable migrator + two-pass + joins + `_airtable_id_map`
- ✅ Schema tweaks on project `wagfkuxkrgsencartqtx`:
  - widened `users.role` check for custom RBAC slugs
  - dropped rigid `notifications.event_type` check (app-layer validation)
  - `va_tasks` gained `assigned_model_ids` / `assigned_model_names` / `overdue_notified_at`
    (`20260803000005_va_tasks_model_cols.sql`)
  - `fines_and_bonuses` gained category/status/source/payment/model/screenshot cols
    (`20260803000006_fines_bonuses_extra_cols.sql`)
  - dual-backend schema gaps (`20260803000007_dual_backend_schema_gaps.sql`)
  - `custom_requests.stuck_alert_sent` boolean default false
    (`20260803000008_custom_requests_stuck_alert_sent.sql`) — cron stuck-alert flag

## Phase 3 — Dual-backend (complete)

### Foundation
- `DATA_BACKEND` env (`airtable` | `supabase`, **default `airtable`**)
- `lib/data-backend.ts` (`isSupabaseBackend()`)
- `lib/supabase-data.ts` helpers (`publicId`, `sbSelectAll`, `sbSelectByPublicId`,
  `sbInsert`, `sbUpdateByPublicId`, `sbDeleteByPublicId`, `sbUuidsForAirtableIds`,
  `sbAirtableIdsForUuids`, `sbFirstLinkedAirtableId`, `sbUpsertByAirtableId`)
- `lib/supabase-signed-url.ts` for Storage-backed attachments

### Attachments → Storage
- ✅ Signed-URL helper: `lib/supabase-signed-url.ts`
- ✅ Attachment migration complete
- Verify script: `npx tsx scripts/verify-signed-urls.ts`
- Retry script: `npx tsx scripts/retry-mss-attachment.ts`

### Dual-backend coverage (all `services/*.ts`)

| Group | Services |
|---|---|
| Foundation | `system-settings`, `roles`, `earnings-config`, `staff-task-types`, `users`, `modelss`, `notifications`, `push-subscriptions`, `notification-preferences`, `activity-logs` |
| Shifts / scheduling | `shifts`, `shift-queue`, `model-schedule`, `model-tasks`, `weekly-program`, `weekly-program-va`, `weekly-availability-requests`, `weekly-availability-requests-va`, `weekly-availability-requests-models` |
| Rewards | `points-engine`, `points-config`, `points-debug-audit`, `spin-wheel`, `challenges`, `fines-bonuses`, `chatter-mistakes` |
| Marketing | `marketing`, `marketing-reviews`, `whales`, `whale-transactions`, `mass-lists` |
| Models / content | `modelss`, `model-content-requests`, `model-expense-requests`, `model-live-streams`, `model-personal-events`, `model-periods`, `model-tiers`, `model-time-off-requests`, `content-items`, `winner-videos`, `winner-recreates`, `video-transcripts`, `pdf-maker`, `research-bunches`, `creator-assignments`, `va-content-assignments` |
| VA workflow | `va-tasks`, `task-templates`, `task-phases`, `custom-requests`, `custom-request-agency-queue`, `sops`, `sop-quiz`, `sop-quiz-attempts`, `sop-progress`, `sop-signoff`, `sop-feedback` |
| Billing / client portal | `client-billing`, `client-portal`, `pricing`, `monthly-targets` |
| Links | `link-pages`, `link-ab-testing`, `link-page-analytics`, `link-redirects` |
| Cascades / cross-service | `accounts-delete`, `force-delete-cascade` |
| Analytics | `pipeline-analytics` |
| Cron / orchestrators | `cron-notification-jobs`, `va-statistics` |
| External sync | `of-sync` (Postgres upsert path) |

### Not-needed (pure orchestrators over already-dual services — no direct Airtable I/O)

`admin-notification-settings`, `check-break-reminders`, `check-late-shifts`,
`client-billing-notifications`, `custom-request-notify-vas`, `daily-summary-cron`,
`hours`, `model-live-notify`, `model-live-scheduled-reminders`, `my-profiles`,
`notification-service`, `of-subscribers` (pure helpers), `period-notifications`,
`sop-academy-notifications`, `sop-academy-overview`, `va-statistics-weekly-cron`,
`va-task-recurring-spawn`, `weekly-program-publish-notify`.

## Cutover checklist

- [ ] Full data migration re-run against staging (verify counts match Airtable)
- [ ] Smoke test each domain by flipping `DATA_BACKEND=supabase` on staging
- [ ] Verify signed URLs load for a sample of migrated attachments
- [ ] Confirm cron routes hit both `runPhaseOverdueCheck` and
      `runPersonalEventReminders` cleanly on Supabase
- [ ] `of-sync` staging run against a low-volume account
  (**note:** a 401 from The Only API / MCP is **not** a Supabase migration bug —
  Postgres upsert in `of-sync-supabase` already works. Confirm `THE_ONLY_API_KEY`
  in local `.env.local` separately; do not treat MCP auth as a dual-backend failure.)
- [ ] Flip production `DATA_BACKEND=supabase`

### Local smoke notes (`scripts/_smoke-supabase-local.ts`)

Run with `DATA_BACKEND=supabase` only in **local** `.env.local` (never Vercel).

| Test | Expectation |
|---|---|
| custom request lifecycle | PASS — needs `custom_requests.stuck_alert_sent` (migration `20260803000008`) |
| client portal payment | PASS — link fields resolve `rec…` → UUID via `sbUuidsForAirtableIds` |
| of-sync chunk | May FAIL with 401 if `THE_ONLY_API_KEY` is missing/invalid — **credential issue outside migration**; Supabase write path is fine |

Schema gap closed: `custom_requests.stuck_alert_sent boolean NOT NULL DEFAULT false`
(matches Airtable checkbox + `runStuckCustomRequestAlerts` cron).

## Feature flag

```ts
process.env.DATA_BACKEND === "supabase" | "airtable"  // default airtable
```
