# Supabase cutover plan

> **Executed 2026-08-04.** See [`CUTOVER_EXECUTED.md`](./CUTOVER_EXECUTED.md) for deployment ID, verification, and exact rollback commands.  
> Original gate: do not run until [`E2E_READINESS_REPORT.md`](./E2E_READINESS_REPORT.md) is **YES** (or CONDITIONAL with accepted residual risks).

This plan flips Production from Airtable (`DATA_BACKEND` unset / airtable) to Supabase.

## Preconditions

- Preview branch `supabase-preview-test` E2E crawl is green (or residual failures accepted in writing).
- Production **does not** currently set `DATA_BACKEND` (verified via `vercel env ls production` — variable absent).
- Preview already sets `DATA_BACKEND=supabase` for git branch `supabase-preview-test` only.
- Airtable remains the system of record until cutover; Supabase holds a migrated copy. **No Airtable wipe.**

## Step 1 — Set Production env (cutover)

In Vercel → Project `chatterswebsite` → Settings → Environment Variables:

1. Add (or edit) **`DATA_BACKEND`** = `supabase`
2. Scope: **Production** only (do not broaden Preview overrides accidentally)
3. Confirm companion vars already exist on Production:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. **Redeploy Production** (env changes apply on next deployment). Prefer a clean redeploy of the current Production commit — no code change required if dual-run is already shipped.

Optional (not required for cutover): `NEXT_PUBLIC_DATA_BACKEND=supabase` for client Realtime detection — only if layouts do not already inject backend via `DataBackendProvider`.

## Step 2 — Watch immediately after

First **15–30 minutes**:

| Signal | Where | Bad pattern |
|--------|--------|-------------|
| Login / session | Vercel Function logs | Auth lookups failing, 5xx on `/login` |
| RSC page loads | Vercel + browser | Spikes of 500, “Something went wrong” |
| Role permissions | `/admin/roles`, staff pages | Empty nav, unexpected `/dashboard` redirects |
| Heavy admin pages | `/admin/va-statistics`, weekly program, VA tasks | Timeouts / blank reports |
| Writes | Task create, shift start/end, tips | Mutations erroring or silent no-ops |
| Cron | Vercel cron logs | Jobs failing after backend flip |

Quick manual smoke (5 min): admin login → VA tasks create → chatter `/weekly-program` (must **not** redirect to `/dashboard`) → VA `/va-tasks` stays on personal board → model schedule.

## Step 3 — Exact rollback (instant, no data loss)

1. In Vercel Production env: **remove** `DATA_BACKEND` (or set it back to `airtable` if you prefer an explicit value).
2. Redeploy Production (or use Instant Rollback to the previous deployment **and** ensure the env no longer forces supabase).
3. App reads Airtable again. **Airtable data was never deleted** by cutover; Supabase writes during the supabase window may not be reflected in Airtable — treat post-cutover Supabase-only writes as the main rollback risk. Prefer a short cutover window and freeze non-critical writes if possible.

Rollback does **not** require migrations down or schema drops.

## Explicit non-actions

- Do **not** delete Airtable bases/tables.
- Do **not** set `DATA_BACKEND=supabase` on Production until readiness is signed off.
- Do **not** run destructive SQL against Production Supabase as part of cutover.
