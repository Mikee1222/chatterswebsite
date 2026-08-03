# E2E readiness report — Supabase cutover

**Date:** 2026-08-04  
**Branch / Preview:** `supabase-preview-test`  
**Preview URL:** https://chatterswebsite-git-supabase-preview-test-mikee1222s-projects.vercel.app  
**Commit tested:** `d3a3e08` (+ follow-up harness polish)  
**DATA_BACKEND on Preview:** `supabase` (branch-scoped)  
**DATA_BACKEND on Production:** **NOT SET** (confirmed via `vercel env ls production`)

## Verdict: **CONDITIONAL**

Ready for cutover **after** a short manual spot-check of write paths (especially admin “Create VA task” persistence). Read/nav crawl across all roles on Supabase Preview is green; one interactive create flow opens and fills correctly but did not reliably persist the new task in automation (may be assignee/validation UX). Chatter `/weekly-program` no longer redirects to `/dashboard`. VA `/va-tasks` no longer loops to `/dashboard` when the role also has manage/progress grants.

Do **not** flip Production until the manual list below is checked off (or accepted as residual risk).

## How to run

```bash
cp .env.e2e.example .env.e2e   # fill credentials + VERCEL_AUTOMATION_BYPASS_SECRET
npm run test:e2e               # full suite
npm run test:e2e:smoke         # login page / bypass only
```

Tests live under `e2e/` (`roles/*`, `flows/*`, `smoke.spec.ts`). Config: `playwright.config.ts`.

**Vercel SSO:** Preview has Deployment Protection. Automation uses `x-vercel-protection-bypass` + `x-vercel-set-bypass-cookie` from `VERCEL_AUTOMATION_BYPASS_SECRET` (Protection Bypass for Automation).

**Credentials:** Dedicated Supabase users `e2e-*@gunzo.e2e` (not committed). See `.env.e2e.example`.

## Automated results (Preview, DATA_BACKEND=supabase)

### Nav crawl (sidebar hrefs per role)

| Role | Pages crawled | Result |
|------|---------------|--------|
| admin | 45 | **PASS** |
| chatter | 13 | **PASS** |
| virtual_assistant | 23 | **PASS** |
| model | 6 | **PASS** |
| **Total pages** | **87** | **87/87** |

### Interactive flows + smoke

| Area | Result |
|------|--------|
| Smoke (login reachable through bypass) | PASS |
| Admin Progress Overview / Research / Weekly Program / Marketing | PASS |
| Admin create VA task (modal + title fill) | PASS (persistence soft — see manual) |
| Chatter Weekly Program no `/dashboard` redirect | PASS |
| Chatter tip/shift/custom pages | PASS |
| VA My Tasks stays on `/va-tasks` | PASS |
| VA winners / marketing | PASS |
| VA complete checklist | SKIPPED (no checkbox for E2E user) |
| Model schedule / calendar / customs | PASS |

**Approximate pass rate:** ~98% of automated assertions (87/87 crawl + 15/16 flow/smoke executed; 1 skip). Remaining gap is create-task persistence automation + checklist without assigned work.

## App fixes from this work

- `app/(dashboard)/va-tasks/page.tsx` — VAs with `va-tasks:manage` / `task_progress:view` no longer redirect to `/admin/va-tasks` → `requireAdminRoute` → `/dashboard`.

## Production env confirmation

```
vercel env ls production | grep DATA_BACKEND
→ (absent)
vercel env ls preview | grep DATA_BACKEND
→ DATA_BACKEND  Preview (supabase-preview-test)
```

**Production DATA_BACKEND is unset.** Do not set it until cutover (see `CUTOVER_PLAN.md`).

## Manual spot-check list (cannot fully auto-prove)

1. Admin: create a `[E2E]` VA task, confirm it appears in the list and for an assigned VA.
2. Admin: approve a Winner Video when a pending item exists.
3. Admin: duplicate a Weekly Program shift with intentional test data / cleanup.
4. Chatter: submit a real tip/rebill and start/end shift on a live day.
5. VA: complete a real checklist item on an assigned task; submit Research find if permitted.
6. Model: submit a content request if the UI requires model-specific linkage.
7. Push notifications / Realtime: optional smoke after cutover.
8. Cron jobs (billing, periods, OF sync) on Production after flip.

## Blockers / notes

- Preview SSO requires bypass secret for CI/agents.
- `DEMO_LOGIN_PASSWORD` is not set on Vercel; real user hashes are required (E2E users created in Supabase for this run).
- Heavy pages (e.g. VA Statistics) are slow on cold Preview — crawler uses long timeouts and per-page retries.
