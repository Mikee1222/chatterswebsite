# Remaining work after Phase 1 (STOP point)

Phase 1 delivered schema SQL + enumeration only. **Do not start a half rewrite of `services/` in the same session.**

## Scope reality check

| Item | Size |
|---|---|
| Airtable tables (audit) | 64 |
| Extra tables used in code | ~33 |
| Postgres tables in migration | 97 + 7 join + `_airtable_id_map` |
| `services/*.ts` | 84 files / ~27k LOC |
| Files importing Airtable | ~140 |
| Setup/audit scripts | ~100 under `scripts/` |
| Estimated full cutover | **Multi-week** (data migration + dual-run + rewrite + QA) |

No Supabase project is linked specifically for Gunzo OS (MCP shows unrelated projects: Kartex, Karagkounis). Create a dedicated project before applying migrations.

## Phase 2 — Data migration scripts

1. Add `@supabase/supabase-js` dependency.
2. `lib/supabase-server.ts` — service-role client from env.
3. `scripts/migrate-airtable-to-supabase.ts`:
   - Paginate each table via existing `lib/airtable-server.ts`
   - Insert rows with new UUIDs; write `_airtable_id_map` + `airtable_id`
   - Remap link fields: Airtable `rec…` arrays → UUID arrays via map
   - Populate join tables from link arrays
4. `scripts/migrate-attachments-to-storage.ts` — download Airtable attachment URLs → Storage; rewrite URL arrays.
5. Verify row counts Airtable vs Supabase per table.
6. **Do not invent production data** if credentials missing — document runbook only.

### PoC status (single table)

- ✅ Connectivity: `scripts/supabase-connectivity-check.ts` (service role; Node uses `scripts/_polyfill-websocket.ts`)
- ✅ First table migrated: **`system_settings`** via `scripts/migrate-system-settings-to-supabase.ts`
  - Why: smallest app-critical lookup (3 fields, no links/attachments)
  - Airtable READ-ONLY; Supabase upsert + `_airtable_id_map`
- ⏸ Stopped — confirm before migrating additional tables. Do not start Phase 3.

## Phase 3 — Rewrite data access layer

Replace Airtable in every `services/*.ts` (~84 modules), priority order suggested:

1. `users`, `roles`, `system_settings` (auth/RBAC path)
2. `shifts`, `shift_models`, `modelss` (hot path)
3. `va_tasks`, `task-phases`, `va-content-assignments` (formula → SQL)
4. `notifications`, `notification-preferences`, `push-subscriptions`
5. Billing / client portal cluster
6. Marketing, SOPs, link pages, rewards, remaining

Keep function signatures / return shapes stable (`id` may remain Airtable-shaped during dual-run via `airtable_id` alias — decide explicitly).

## Phase 4 — Dependent code

- Attachment URL consumers, public link pages
- Notification `event_type` constraint already drafted — keep in sync with `lib/notifications-schema.ts`
- Remove Airtable SDK / `lib/airtable-*.ts` only after green dual-run
- Update docs under `docs/Gunzo OS Docs/`

## Phase 5 — Verification

- Full `npx tsc --noEmit`
- Staging smoke: login, shift start/end, VA tasks, notifications, billing submit, link page
- Row-count + spot FK integrity checks

## Recommended session plan

| Session | Goal |
|---|---|
| ✅ This one | Phase 1 schema + docs + env example |
| Next | Dedicated Supabase project + apply migrations + Phase 2 scripts (no service rewrite) |
| Following | Phase 3 in vertical slices with dual-read feature flag |
| Final | Cutover, remove Airtable, Phase 5 |

## Feature-flag idea (Phase 3)

```ts
process.env.DATA_BACKEND === "supabase" | "airtable"
```

Default `airtable` until a slice is proven. Enables incremental PRs instead of a big-bang rewrite.
