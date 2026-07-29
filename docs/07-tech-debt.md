# 07 — Known Open Issues & Tech Debt

Honest inventory of deferred work, rough edges, and areas that need caution. Not a roadmap — a hazard map for incoming developers.

---

## TypeScript strict mode (~629 errors)

Standard `npm run typecheck` passes (0 errors). Strict overlay (`tsconfig.strict.json`) has ~629 remaining errors — mostly TS4111 index signature access on Airtable-shaped records.

Top offenders: `services/weekly-availability-requests.ts`, `lib/weekly-program-conflicts.ts`, `services/weekly-program.ts`, `services/shifts.ts`.

See [TYPESCRIPT_IMPROVEMENT.md](./TYPESCRIPT_IMPROVEMENT.md).

**Impact:** Refactors in these files may need extra bracket notation or type narrowing. Not blocking deploys.

---

## Dual deployment targets (Cloudflare + Vercel)

The codebase supports both Cloudflare Pages (OpenNext) and Vercel hosting. Some features assume Vercel:

- Vercel Blob uploads
- Vercel Domains API for link pages
- `@vercel/blob` imports in API routes

**Impact:** Full feature parity on Cloudflare-only deploy requires alternative blob storage or accepting degraded upload features.

---

## Athens timezone simplification

Two coexisting approaches:

1. `ymdInAthens()` — proper IANA `Europe/Athens`
2. `getNowInAthens()` — fixed UTC+3 year-round

**Impact:** Edge cases around DST transitions may show inconsistent "week start" vs "task day" bucketing. Documented in `lib/airtable-datetime.ts`.

---

## `"use server"` on service modules

Many `services/*.ts` files declare `"use server"` at module scope even when only containing data access helpers.

**Impact:** Larger server action surface, occasional bundler boundary confusion, harder to share code with non-action contexts. Prefer moving pure logic to `lib/` when refactoring.

---

## README vs actual codebase drift

Root `README.md` describes an earlier subset of tables and roles. This handover docs series supersedes it for onboarding. README still useful for quick stack summary.

**Impact:** New devs should start at `docs/README.md`, not root README alone.

---

## Model portal "My earnings"

Nav item at `/model/earnings` marked **Coming soon** (`disabled: true` in `modelNav`).

**Impact:** Route exists but feature incomplete.

---

## Admin earnings config hidden from nav

`/admin/earnings-config` route works if opened directly but nav item is commented out in `lib/nav-config.ts`.

**Impact:** Discoverability — only admins who know the URL can reach it.

---

## Legacy weekly-program permissions

`weekly-program:view/manage` still exist but split into `chatter_program:*` and `va_program:*`. RBAC expands legacy grants automatically.

**Impact:** Roles UI may show both old and new permissions during migration period. Prefer assigning split permissions for new roles.

---

## Notification testing in production

Diagnostic and test routes gated by `ENABLE_NOTIFICATION_TESTING=true` **and** admin session.

**Impact:** Production notification debugging requires explicit env flag — intentional safety measure.

---

## Webhook verification optional

`/api/webhooks/onlyapi` accepts unverified webhooks when `ONLYAPI_WEBHOOK_SECRET` is unset (logs warning).

**Impact:** Set secret in production.

---

## Transcription service external dependency

No in-repo transcription worker. Requires separately hosted HTTP service with `TRANSCRIBE_SERVICE_URL`.

**Impact:** Feature completely non-functional without deployment of external service (often HuggingFace Whisper Space or similar).

---

## Realtime worker optional

Without `realtime/` worker deployed, notifications rely on SWR refresh / page navigation — no live toast push over WebSocket.

**Impact:** Acceptable degradation; not all deployments configure realtime.

---

## Airtable as sole database

No Postgres/Supabase for business data. Airtable rate limits (5 req/s per base) and formula complexity cap apply.

Mitigations: `lib/airtable-queue.ts`, scoped formulas (`buildGetAllVaTasksFormula`), caching in `unstable_cache` for some reads.

**Impact:** High-traffic admin pages that scan full tables may hit rate limits. VA tasks admin fetch uses date windows to mitigate.

---

## Duplicate / orphan pages

`scripts/find-unused-pages.ts` can detect pages without nav links. Some legacy routes may still exist (e.g. duplicate login at `app/(auth)/login 2/`).

**Impact:** Run `npm run find:unused` periodically; don't delete without verifying no external links.

---

## VA recurring task historical duplicates

Race conditions before spawn mutex fix may have left duplicate real rows for same series + day.

**Fix:** `scripts/cleanup-duplicate-recurring-tasks.ts`

**Impact:** Progress Overview may show inflated counts until cleaned.

---

## Stuck model live streams

Streams with `status: live` but stale `actual_end` block new live sessions.

**Fix:** `scripts/clear-stuck-live-streams.ts`

---

## Infloww API legacy

`lib/infloww-api.ts` — legacy integration code, partially cleaned for strict TS. Verify before extending.

---

## Custom role home page minimal

Custom roles land on `/admin/custom-role-home` — basic dashboard, not tailored per role.

**Impact:** Custom roles rely entirely on permission-filtered nav; no bespoke landing UX.

---

## Client role nav

`client` role has no entry in standard nav arrays — client portal uses its own layout/routes under `/client/*`.

---

## Pre-RBAC migration artifacts

Some API routes and older components may still use role string checks. Grep for `user.role ===` when auditing — should use `hasPermission()`.

---

## Missing automated E2E tests

No Playwright/Cypress suite. Regression reliance on manual QA + `scripts/verify-*.ts`.

**Impact:** VA tasks, notifications, and billing flows need manual verification after changes.

---

## Recent fix areas (exercise caution when modifying)

These areas had recent bug fixes — extra testing recommended:

| Area | What was fixed |
|------|----------------|
| VA tasks recurring | Virtual projection, today-only spawn, mutex de-dupe |
| Weekly program | Time normalization, conflict detection, Athens week start |
| Model live streams | Active detection formula, model link field rename, JS filtering |
| Nav / permissions | `sharedPermissionNavItems`, submit/manage dedup, custom role VA tasks href |
| Winner videos / research | Submit vs manage nav, creative assignment flow |

---

## Suggested prioritization for new team

1. **Don't break:** RBAC, VA task spawn/projection, notification create path
2. **Improve:** Strict TS error count, E2E test coverage for critical flows
3. **Consolidate:** Single deployment target decision (CF vs Vercel)
4. **Document in code:** When fixing debt items, update this file

---

## Related

- [05-bug-patterns.md](./05-bug-patterns.md)
- [TYPESCRIPT_IMPROVEMENT.md](./TYPESCRIPT_IMPROVEMENT.md)
