# Schema design decisions (Phase 1)

## Identity model

| Airtable | Postgres |
|---|---|
| Record ID `rec…` | `id uuid` PK + `airtable_id text UNIQUE` during/after migration |
| Stable slug `user_id` / `model_id` (text) | Kept as text columns for backwards-compatible filters; Phase 3 collapses `rec…` vs slug dual-lookup to UUID FKs |
| Linked record arrays | `uuid[]` columns initially; **join tables** for hot M2M paths that hit ARRAYJOIN bugs |

## Type mapping

| Airtable | Postgres |
|---|---|
| singleLineText / multilineText / richText | `text` |
| number / currency / percent / autoNumber | `numeric` |
| checkbox | `boolean` |
| date | `date` |
| dateTime / createdTime / lastModifiedTime | `timestamptz` (UTC; display `Europe/Athens`) |
| singleSelect | `text` + CHECK where critical (`notifications.event_type`, `users.role`, …) |
| multipleSelects | `text[]` |
| multipleRecordLinks | `uuid[]` (or join table) |
| multipleAttachments | `text[]` of Storage URLs |
| formula / rollup / lookup | Omitted from base tables; SQL views or app recompute |

## Join tables (ARRAYJOIN fix)

Airtable `ARRAYJOIN` / `FIND` on linked fields matches **primary field display values**, not `rec` IDs — a recurring production bug. Postgres FKs eliminate that class of bugs:

- `va_task_assignees` — VA task ↔ users
- `va_task_models` — VA task ↔ modelss
- `va_content_assignment_vas`
- `client_model_assignments`
- `shift_model_links`
- `custom_request_assignees`
- `sop_role_users`

Phase 3 services should prefer join tables for filters that today use fragile Airtable formulas (`lib/va-tasks-airtable-formula.ts`, content-assignment VA lookups, etc.).

## Attachments → Storage

Buckets (migration `20260803000003`):

| Bucket | Public | Use |
|---|---|---|
| `attachments` | no | Generic Airtable attachment replacements |
| `feedback-screenshots` | no | Feedback UI |
| `payment-proofs` | no | Billing payment submissions |
| `link-page-assets` | **yes** | Public link-in-bio images |
| `sop-files` | no | SOP PDFs / uploads |
| `winner-videos` | no | Winner video pipeline |

URL columns store full Storage paths or public URLs. Existing **Vercel Blob** usage can remain for some upload paths until Phase 4 unifies them.

## Formula / rollup replacements

| Airtable | Replacement |
|---|---|
| `billing_cycle_revenues.fee_usd` | `v_billing_cycle_revenues.fee_usd_computed` |
| `billing_cycles.total_*` rollups | `v_billing_cycle_revenue_totals` |
| Chatter Performance formulas | Leave legacy; not on critical app path — revisit if needed |
| Deadline formulas on complaints | App-level |

## RLS

Phase 1: **service-role-only**. Every table has RLS enabled with no policies for `anon` / `authenticated`. The Next.js server uses `SUPABASE_SERVICE_ROLE_KEY`, matching today’s Airtable PAT trust boundary.

Later: map `lib/permissions.ts` to RLS policies (or keep authorization in the app layer and keep service-role for server routes only — recommended given JWT session cookies are not Supabase Auth).

## Auth note

This app uses **custom JWT session cookies** (`SESSION_JWT_SECRET`), not Supabase Auth. Do not assume `auth.uid()` for RLS until/unless auth is migrated. Service-role server access is the correct Phase 1–3 model.

## Dual bases / naming quirks preserved

- App table is `modelss` (not legacy `models`) — both exist in schema; app uses `modelss`.
- `fines_and_bonuses` (app) vs `fines_and_bonuses_legacy` (Airtable “Fines & Bonuses”).
- Greek / internal sheets (`self_evaluations`, `chatters`, …) marked legacy.
