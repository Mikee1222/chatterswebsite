# Remaining work after Phase 2/3 progress

## Done this session

### Phase 2 — Data migration
- ✅ Reusable migrator + two-pass + joins + `_airtable_id_map`
- ✅ Schema tweaks on project `wagfkuxkrgsencartqtx`:
  - widened `users.role` check for custom RBAC slugs
  - dropped rigid `notifications.event_type` check (app-layer validation)
  - `va_tasks` gained `assigned_model_ids` / `assigned_model_names` / `overdue_notified_at`
    (`20260803000005_va_tasks_model_cols.sql`)

### Phase 3 — Dual-backend
- ✅ `DATA_BACKEND` env (`airtable` | `supabase`, **default `airtable`**)
- ✅ Dual-backend: `system-settings`, `roles`, `earnings-config`, `staff-task-types`
- ✅ Dual-backend: `users`, `modelss`, `shifts` / `shift_models`
- ✅ Dual-backend: `marketing` (accounts, phones, shadowban, funnels, platforms)
- ✅ Dual-backend: `winner-videos` (+ creative scripts persist path)
- ✅ Dual-backend: `task-templates` + `task-phases` (virtual projection unchanged)
- ✅ Dual-backend: `va-tasks` (SQL visibility/date filters; uuid[] assignees + join sync)
- ✅ Dual-backend: `notifications` (create/list/unread/mark/delete/find)
- ⚠ **Do not set `DATA_BACKEND=supabase` in Vercel production** until cutover

### event_type design choice
**Permissive `text` + app validation** (`validateNotificationPayload` / `NOTIFICATION_EVENT_TYPES`).
No Postgres ENUM/CHECK. Airtable `typecast: true` remains Airtable-only and is **not**
required on the Supabase write path.

### Attachments → Storage
- ✅ Signed-URL helper: `lib/supabase-signed-url.ts`
  (`resolveStorageUrl`, `urlsToAttachments`, `uploadToPrivateStorage`)
- ✅ Wired on dual-backend reads (marketing / winner-videos / task-phases / users contracts)
- ✅ Attachment migration complete for remaining tables:
  - `mss` 1268/1269 → `sb://` (1 timed-out Airtable download kept as fallback)
  - `rebills` 135, `shadowban_reports` 1, `invoices` 1 → `sb://`
  - `paypal_money_received` attachments migrated
  - `winner_videos` / `marketing_phones` / `model_social_accounts`: no attachment rows in Airtable
  - legacy sheets re-synced
- ✅ Sample signed HEAD **200**: payment_submissions, chatter_mistakes, va_task_phase_items,
  mss, rebills, shadowban_reports, invoices
- ✅ Links pass re-run after attachments on linked tables
- Verify script: `npx tsx scripts/verify-signed-urls.ts`

## Skipped / blocked tables

| Postgres table | Reason |
|---|---|
| `creators` | Removed from Airtable — unused |
| `chatter_complaints` | Removed from Airtable — unused |
| `whale_tracker` | Removed from Airtable — unused |
| `fines_and_bonuses_legacy` | Removed from Airtable |
| `marketing_funnels` | Removed; **`model_funnel_links` is current** |

## Next session priority

1. Staging smoke with `DATA_BACKEND=supabase` (never production until green)
2. Dual-backend remaining high-traffic services (billing, VA content, whales, …)
3. Retry the 1 failed `mss` Airtable download if needed
4. Consider API proxy if any client ever receives raw `sb://` tokens

## Feature flag

```ts
process.env.DATA_BACKEND === "supabase" | "airtable"  // default airtable
```
