# Supabase migration (Airtable → Postgres)

Phase 1 (schema design) deliverables for Gunzo OS / chatter-dashboard.

| Doc | Contents |
|---|---|
| [01-table-enumeration.md](./01-table-enumeration.md) | Every Airtable table/field inventory |
| [02-schema-design.md](./02-schema-design.md) | Mapping decisions (FKs, storage, formulas, RLS) |
| [03-remaining-work.md](./03-remaining-work.md) | Phases 2–5 plan + why we stopped after Phase 1 |

## Migrations

```
supabase/migrations/
  20260803000001_init_schema.sql      # tables, views, join tables, id map
  20260803000002_rls_service_role.sql # RLS on, service-role-only
  20260803000003_checks_and_storage.sql
  20260803000004_widen_users_role_check.sql / 20260803000004_new_app_tables.sql
  20260803000005_va_tasks_model_cols.sql
  20260803000006_fines_bonuses_extra_cols.sql
  20260803000007_dual_backend_schema_gaps.sql
  20260803000008_custom_requests_stuck_alert_sent.sql
```

## Smoke / of-sync note

`scripts/_smoke-supabase-local.ts` test `7_of_sync_chunk` may return **401** when
`THE_ONLY_API_KEY` is missing or invalid. That is an **external credential** check,
not a Supabase migration failure — the `of-sync-supabase` upsert path is already
wired. Fix the key in local `.env.local` only; do not chase MCP auth as dual-backend work.

## Apply (after creating a dedicated Supabase project)

```bash
npx supabase link --project-ref <YOUR_REF>
npx supabase db push
```

Set in Vercel / `.env.local` (see `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
