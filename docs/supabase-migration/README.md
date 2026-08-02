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
```

## Apply (after creating a dedicated Supabase project)

```bash
npx supabase link --project-ref <YOUR_REF>
npx supabase db push
```

Set in Vercel / `.env.local` (see `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
