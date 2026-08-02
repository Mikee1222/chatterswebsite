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

### Phase 3 — Dual-backend (started)
- ✅ `DATA_BACKEND` env (`airtable` | `supabase`, **default `airtable`**)
- ✅ `lib/data-backend.ts`, `lib/supabase-data.ts`
- ✅ Dual-backend services: `system-settings`, `roles`, `earnings-config`, `staff-task-types`
- ⚠ **Do not set `DATA_BACKEND=supabase` in Vercel production** until cutover

## Skipped / blocked tables

| Postgres table | Reason |
|---|---|
| `creators` | Removed from Airtable |
| `chatter_complaints` | Removed from Airtable |
| `whale_tracker` | Removed from Airtable |
| `fines_and_bonuses_legacy` | Removed from Airtable (`fines_and_bonuses` app table migrated) |
| `marketing_funnels` | Removed; Airtable now has `model_funnel_links` (needs schema add) |

Renamed and migrated: `marketing_phones` ← Airtable `phones`.

## New Airtable tables not in Phase 1 schema

These exist in Airtable but have **no** Postgres table yet — next session should enumerate + migrate:

- `chatter_mistakes`, `mistake_reasons`
- `content_items`, `content_item_events`, `creator_assignments`
- `marketing_daily_reviews`, `marketing_exec_audits`, `marketing_spot_checks`
- `model_funnel_links`
- `research_bunches`, `research_ideas`
- `task_templates`, `task_template_phases`, `task_template_items`

## Attachments

Attachment columns currently store **Airtable CDN URLs** (scalars pass with `--skip-attachments`).  
Run with attachments enabled when ready:

```bash
npx tsx scripts/migrate-airtable-to-supabase.ts --tables billing_cycles,payment_submissions,feedback --pass attachments
```

## Next session priority

1. Schema for new Airtable-only tables above + migrate
2. Continue dual-backend: `users` → `modelss` → `shifts` / `shift_models`
3. Attachment Storage rewrite for critical buckets
4. Staging smoke with `DATA_BACKEND=supabase` (never production until green)
5. Full `npx tsc --noEmit` + row-count verify before any cutover

## Feature flag

```ts
process.env.DATA_BACKEND === "supabase" | "airtable"  // default airtable
```
