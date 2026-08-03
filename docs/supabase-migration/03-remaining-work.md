# Remaining work after Phase 2/3 progress

## Done this session

### Phase 2 — Data migration
- ✅ Reusable migrator: `scripts/lib/supabase-migrate.ts` + `scripts/migrate-airtable-to-supabase.ts`
- ✅ Two-pass migration (scalars → uuid[] link remap) + join tables
- ✅ `_airtable_id_map` populated (~40k rows)
- ✅ Most Airtable tables migrated with count match (see session report)
- ✅ Schema tweaks on project `wagfkuxkrgsencartqtx`:
  - widened `users.role` check for custom RBAC slugs
  - dropped rigid `notifications.event_type` check (app-layer validation)
- ✅ **New tables** (migration `20260803000004_new_app_tables.sql`) + data migrated:
  - `mistake_reasons` (27), `chatter_mistakes` (158)
  - `model_funnel_links` (0 — empty but schema ready; replaces gone `marketing_funnels`)
  - `task_templates` / `task_template_phases` / `task_template_items` (1/2/24)
  - `marketing_daily_reviews` / `marketing_spot_checks` / `marketing_exec_audits` (1/0/4)
  - `creator_assignments`, `research_bunches`, `research_ideas`, `content_items`, `content_item_events`
- ✅ Core column gaps backfilled on `users` / `modelss` / `shifts` + re-synced

### Phase 3 — Dual-backend
- ✅ `DATA_BACKEND` env (`airtable` | `supabase`, **default `airtable`**)
- ✅ Dual-backend: `system-settings`, `roles`, `earnings-config`, `staff-task-types`
- ✅ Dual-backend: `users`, `modelss`, `shifts` / `shift_models`
- ⚠ **Do not set `DATA_BACKEND=supabase` in Vercel production** until cutover

### Attachments → Storage
- ✅ Critical buckets rewritten to `sb://bucket/path` tokens (private buckets; verify via signed URL):
  - `payment_submissions`, `feedback`, `billing_cycles`, `users`, `chatter_mistakes`,
    `marketing_daily_reviews`, `va_task_phase_items` (3449 rows — ~13 min)
- ✅ Sample signed HEAD checks returned **200** for payment proofs, feedback, mistakes, VA screenshots
- ⏳ Remaining attachment tables: `winner_videos`, `notifications`, `mss`, `invoices`,
  `rebills`, `model_social_accounts`, `shadowban_reports`, `marketing_phones`, legacy sheets

## Skipped / blocked tables

| Postgres table | Reason |
|---|---|
| `creators` | Removed from Airtable — **unused in app services** (grep clean aside from migrator) |
| `chatter_complaints` | Removed from Airtable — unused |
| `whale_tracker` | Removed from Airtable — unused |
| `fines_and_bonuses_legacy` | Removed from Airtable (`fines_and_bonuses` app table migrated) |
| `marketing_funnels` | Removed; **`model_funnel_links` is current** (schema + migrate done) |

Renamed and migrated: `marketing_phones` ← Airtable `phones`.

## Attachments note

Private Storage buckets store `sb://bucket/objectPath`. Before cutover, dual-backend readers
must mint signed URLs (service role). Public `getPublicUrl` only works for `link-page-assets`.

After `--pass attachments`, always re-run `--pass links` on the same tables (scalar upsert nulls uuid[] links).

## Next session priority

1. Remaining attachment tables (`winner_videos`, notifications, …)
2. Signed-URL helper for `sb://` tokens in dual-backend services
3. More dual-backend services (VA tasks, notifications, …)
4. Staging smoke with `DATA_BACKEND=supabase` (never production until green)
5. Full `npx tsc --noEmit` + row-count verify before any cutover

## Feature flag

```ts
process.env.DATA_BACKEND === "supabase" | "airtable"  // default airtable
```
