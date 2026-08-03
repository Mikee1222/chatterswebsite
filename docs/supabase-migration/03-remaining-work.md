# Remaining work after Phase 2/3 progress

## Done this session

### Phase 2 — Data migration
- ✅ Reusable migrator + two-pass + joins + `_airtable_id_map`
- ✅ Schema tweaks on project `wagfkuxkrgsencartqtx`:
  - widened `users.role` check for custom RBAC slugs
  - dropped rigid `notifications.event_type` check (app-layer validation)
  - `va_tasks` gained `assigned_model_ids` / `assigned_model_names` / `overdue_notified_at`
    (`20260803000005_va_tasks_model_cols.sql`)
  - `fines_and_bonuses` gained category/status/source/payment/model/screenshot cols
    (`20260803000006_fines_bonuses_extra_cols.sql`)

### Phase 3 — Dual-backend
- ✅ `DATA_BACKEND` env (`airtable` | `supabase`, **default `airtable`**)
- ✅ Dual-backend: `system-settings`, `roles`, `earnings-config`, `staff-task-types`
- ✅ Dual-backend: `users`, `modelss`, `shifts` / `shift_models`
- ✅ Dual-backend: `marketing` (accounts, phones, shadowban, funnels, platforms)
- ✅ Dual-backend: `winner-videos` (+ creative scripts persist path)
- ✅ Dual-backend: `task-templates` + `task-phases` (virtual projection unchanged)
- ✅ Dual-backend: `va-tasks` (SQL visibility/date filters; uuid[] assignees + join sync)
- ✅ Dual-backend: `notifications` (create/list/unread/mark/delete/find)
- ✅ Dual-backend: `client-billing` (+ notifications cron uses dual-backed billing APIs)
- ✅ Dual-backend: `whales`, `whale-transactions`
- ✅ Dual-backend: `model-content-requests`, `model-live-streams`
- ✅ Dual-backend: `fines-bonuses`, `challenges`
- ⚠ **Do not set `DATA_BACKEND=supabase` in Vercel production** until cutover

### Attachments → Storage
- ✅ Signed-URL helper: `lib/supabase-signed-url.ts`
- ✅ Attachment migration complete including previously stuck `mss` row
  `recjAcObgwjPGXoW8` (retried with 180s timeout → `sb://`)
- ✅ Migrator download timeout raised 45s → 180s
- Verify script: `npx tsx scripts/verify-signed-urls.ts`
- Retry script: `npx tsx scripts/retry-mss-attachment.ts`

## Still pending dual-backend (priority)

1. `va-content-assignments`
2. `custom-requests` / `custom-request-agency-queue`
3. `points-engine` (+ related points-config / spin-wheel)
4. `weekly-program` / `weekly-program-va`
5. `sops` (+ sop-progress / quiz / signoff / feedback)
6. `model-schedule`
7. `client-portal` (payment/billing portal surfaces)
8. Other Airtable services (availability, mistakes, marketing-reviews, pipeline, …)

## Feature flag

```ts
process.env.DATA_BACKEND === "supabase" | "airtable"  // default airtable
```
