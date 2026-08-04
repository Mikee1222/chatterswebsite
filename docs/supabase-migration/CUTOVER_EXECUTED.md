# Production cutover executed — Supabase

**Status:** COMPLETED  
**When:** 2026-08-04 ~02:37 EEST (UTC+3)  
**Executed by:** agent (user-requested production cutover)

## What changed (Vercel Production only)

| Variable | Action | Scope |
|----------|--------|--------|
| `DATA_BACKEND` | Set to `supabase` | **Production** only |
| `NEXT_PUBLIC_SUPABASE_URL` | Added `https://wagfkuxkrgsencartqtx.supabase.co` (was missing on Production; Preview-only before) | **Production** |

Already present on Production (unchanged): `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, Airtable keys (kept for instant rollback).

**Not changed:** Airtable code/dependencies, Preview `DATA_BACKEND` (still branch-scoped to `supabase-preview-test`), no Airtable wipe.

## Production deployment

| Field | Value |
|-------|--------|
| Deployment ID | `dpl_2kmDEf6cJnaQL6aGWEyfYnY7Dp5k` |
| URL | https://chatterswebsite-6xvv99g15-mikee1222s-projects.vercel.app |
| Aliases | https://www.gunzoteam.com , https://gunzoteam.com |
| Git branch | **`main`** (not `supabase-preview-test`) |
| Git SHA | `b54567a690f0a4b46f0057e162c66312b82bdb7b` |
| Method | `vercel redeploy` of prior Production commit after env set (least-risk) |
| Ready | ~02:37–02:41 EEST 2026-08-04 |

Dual-backend support confirmed on this `main` commit (`lib/data-backend.ts` + `isSupabaseBackend` service forks).

## Hotfix — preview fixes merged to main (2026-08-04)

| Field | Value |
|-------|--------|
| Action | Fast-forward merge `supabase-preview-test` → `main` |
| Merge commit / HEAD | `430cd7847364cc1fdf4c2005a8b2bee8f486e6de` |
| Previous Production SHA | `b54567a690f0a4b46f0057e162c66312b82bdb7b` (missing today's fixes) |
| Includes | getUnreadCount date fix, dual-backend N+1, Weekly Program redirect, mobile UI, Priority 4/5, Realtime, E2E harness, cutover docs |
| Why | Production was live on `DATA_BACKEND=supabase` but still running old `main@b54567a`, causing getUnreadCount 500s and page timeouts |

Update the Production deployment ID/URL below after Vercel redeploys from this push. Rollback still uses `vercel env rm DATA_BACKEND production -y` then `vercel redeploy <latest-prod-deployment-url> --target=production`.

## Verification summary

| Check | Result |
|-------|--------|
| Homepage / login HTML | **PASS** — `/login` HTTP 200, Sign in UI |
| Smoke `test:e2e:smoke` @ Production | **PASS** (1/1) |
| Full Playwright suite @ Production | **FAIL** (harness) — navigation races / long streaming loads; admin shell + live sidebar data confirmed in failure screenshots (`e2e-admin@gunzo.e2e`, “5 shifts active”) |
| Focused admin crawl | **FAIL** (timeout waiting for `/admin` `load` while skeletons still streaming) |
| Server login | **OK** — `POST /login` → 303 in Vercel logs |
| Rollback executed? | **NO** — not meeting critical bar (login not systematically broken; no mass page 500s) |

### Log check (first ~30–45 min)

- **Dominant error:** `GET /api/notifications/unread-count` → 500 `getUnreadCount:` (empty detail). Badge poller only; app shell still loads.
- **Runtime timeouts (200 + timeout message):** `/admin/weekly-program`, `/admin/va-statistics`, `/shift` under load.
- **No mass RSC 500 spike** on core `/admin` / `/home` routes in sampled logs.

## Instant rollback (Airtable untouched)

```bash
# 1) Remove Production DATA_BACKEND (defaults back to airtable)
vercel env rm DATA_BACKEND production -y

# Optional: leave NEXT_PUBLIC_SUPABASE_URL in place (harmless while DATA_BACKEND unset)
# or remove it too:
# vercel env rm NEXT_PUBLIC_SUPABASE_URL production -y

# 2) Redeploy current Production deployment (same commit, new env)
vercel redeploy chatterswebsite-6xvv99g15-mikee1222s-projects.vercel.app --target production
# Or redeploy whatever is currently aliased to www.gunzoteam.com:
# vercel ls chatterswebsite --prod
# vercel redeploy <latest-prod-deployment-url> --target production
```

Alternate explicit value instead of remove:

```bash
vercel env rm DATA_BACKEND production -y
vercel env add DATA_BACKEND production --value airtable -y --no-sensitive
vercel redeploy <latest-prod-deployment-url> --target production
```

After rollback: app reads Airtable again. Supabase-only writes during the supabase window may not exist in Airtable.

## Explicit non-actions taken

- Did **not** delete Airtable bases/tables or remove dual-backend code.
- Did **not** set unrelated env vars beyond companion `NEXT_PUBLIC_SUPABASE_URL` required by `CUTOVER_PLAN.md`.
- Did **not** run destructive SQL on Production Supabase.
