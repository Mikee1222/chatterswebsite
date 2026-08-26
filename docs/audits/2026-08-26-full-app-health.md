# Full-app health-check audit — 2026-08-26

Post high-velocity feature week (Applications, Password Library, Task Timer, Winner Hub,
Instagram Insights Weekly Progress, Creator Earnings, Infloww billing/status/reassignments).
Scope: performance, forgotten/incomplete items, safe fixes only. Larger work flagged for decision.

**Prod project:** `wagfkuxkrgsencartqtx` (Gunzo)  
**Commit context:** main @ audit day (Winner thumbnails / Password Library / Admin Home fixes already landed).

---

## 1. Performance findings + fixes applied

### Indexes (verified via `pg_indexes` + Supabase performance advisors)

| Table | Before | Action |
|-------|--------|--------|
| `task_category_time_entries` | Had va/task/item/category indexes; **no `started_at`** despite reporting filters | **Fixed-now:** `(va_id, started_at DESC)` + `(started_at DESC)` |
| `credential_entries` | `model_id`, `category` separate | **Fixed-now:** composite `(model_id, category)` |
| `application_form_responses` | `(form_id, submitted_at)`, `(form_id, status)` | OK — no change |
| `infloww_monthly_billing` | `(billing_period DESC)` | OK for agency-level rows (~12) |
| `infloww_sales_reassignments` | time + transaction | **Fixed-now:** partial `(after_employee_id)` |
| `infloww_creator_status_log` | model/creator/time | OK (table currently empty — see §2) |
| `clariosuite_top_posts` | ig+media, ig+rank, model_record | **Fixed-now:** account FK, `posted_at`, insights-retry partial |
| `clariosuite_daily_insights` / `audience_snapshots` | Advisor: unindexed `clariosuite_model_account_id` FK | **Fixed-now:** partial FK indexes |

Migration: `supabase/migrations/20260826160000_health_audit_indexes.sql` (applied to prod).

### N+1 / batch patterns (code spot-check)

| Area | Verdict |
|------|---------|
| Task Timer (`task-category-timer`) | Enrichment uses `.in()` batch loads — good |
| Password Library | List is single query; no per-entry decrypt on list |
| Application Forms overview | Batch responses by `form_id IN (...)` — good |
| Winner Videos Hub / auto-detect | Posts + thresholds batched; notify loop was sequential → **Fixed-now:** `Promise.all` in `winner-sourcing` |
| Instagram Weekly Progress | Already batched (`Promise.all` daily/top/OF); prior 4-month tx scan fixed (lookback ~14d) |
| Creator Earnings sync | **Per-creator** tx/perf loop is intentional (Infloww rate limits) — do not parallelize aggressively |
| Winner Group-by-Model | In-memory group after batched fetches — acceptable at current scale |

### Over-fetch / memoization

- Weekly Progress + Creator Earnings dashboards recompute on request (server); no unsafe client memoization debt spotted.
- Applications Response Dashboard is small (2 forms, 1 response) — fine.
- **Needs-decision:** page-level React Query / route cache for Weekly Progress if traffic grows.

### Sync job overlap / rate limits

| Job | Cadence | Notes |
|-----|---------|-------|
| Infloww employee+creator | GHA hourly `0 * * * *` + Vercel daily `15 3` | Primary consumer of Infloww QPM |
| ClarioSuite | GHA every 2h `0 */2 * * *` + Vercel daily `30 4` | Collides with Infloww on even-hour `:00` |
| Status log + sales reassignments | Called **inside** hourly Infloww cron (`dailySync*`) | Extra Infloww calls every hour |
| Monthly billing | Vercel daily `0 4` | Strict 10 QPM — isolated OK |
| Winner auto-detect | After ClarioSuite sync | Depends on media insights freshness |

**Needs-decision:** Stagger ClarioSuite GHA off `:00` (e.g. `:15`) and/or gate status-log + reassignment syncs to once/day to reduce contention with the main Infloww hourly sync.

---

## 2. Forgotten / incomplete — fixed-now vs needs-decision

### Resolved / already fixed (verify state)

| Item | State |
|------|--------|
| IG Insights nav permission for non-admin roles with grant | **Resolved** — `getPermissionGatedAdminNavItems()` + `permissionForSharedAdminPath()` in layout/middleware |
| `credentials:*` / `applications:*` route enforcement | **OK** — pages use `requireAdminRoute`; APIs 401/403 via `hasPermission` |
| Application notification events | **Wired** — `application_submitted` / `application_status_changed` in types, routing, role defaults (admin/manager) |
| Opt-in defaults | Credentials + Applications in `MANAGER_EXCLUDED` (Roles UI opt-in) — intentional |
| Creator Earnings amount / timezone / fees | Multiple accuracy commits Aug 20 — treated as resolved unless new lag reports |
| Weekly Progress OF revenue path | Consolidated to shared Athens/net functions |
| Password Library reveal/copy/SIM | Fixed today (`c054a16`) |
| Winner ephemeral CDN thumbnails | Fixed today (`4574167`) |
| Admin Home hang / ClarioSuite Sync Now | Fixed today (`b32142c`) |

### Fixed-now (this audit)

| Item | Action |
|------|--------|
| Missing indexes (advisor + timer/credentials/top posts) | Migration applied |
| Winner notify sequential N+1 | Parallelized with `Promise.all` |
| Audit documentation | This file |

### Needs-a-decision

| Item | Evidence | Suggested decision |
|------|----------|-------------------|
| Infloww org-scope / sales reassignments | Code still documents 403 “organization scope may not be active”; prod has **1** reassignment row | Confirm org endpoint with Infloww; if unlocked, re-backfill history |
| Creator Status Log empty | `infloww_creator_status_log` count = **0**; hourly sync only covers last 48h | Run one-shot `backfillCreatorStatusLog` (script / admin route) after confirming API returns data |
| Frost ClarioSuite / “Frost Media not found” | Frost **is** linked (`rec3R1BEED9weYPfE`, 105 top posts). Zhanna Frost has **no** Infloww ID | Likely transient API / wrong account name search — not a missing model link for Frost. Decide whether Zhanna Frost needs ClarioSuite linking |
| Stories metrics limitation | UI already shows “metrics only if API provides them” | Product: accept Meta/ClarioSuite limitation vs find alternate source |
| Free vs Paid New Subs unavailable | Not exposed as a first-class metric in Insights UI | Product: hide/relabel vs wait for Infloww field |
| Frika/Lydia ~$12 lag | No live repro in this audit; prior accuracy passes claimed fixed | Spot-check one Athens day vs Infloww UI before further code; escalate only if still off |
| Docs for new perms | No `docs/` coverage for Password Library / Applications RBAC | Add short RBAC notes to handover docs |
| Test application response | 1 response (`new`, EL, Chatter form, 2026-08-20) | Confirm if real candidate vs QA seed — delete if seed |
| Pending auto-detected winners | 10 winner + 3 super_winner pending | Review/approve in Hub — not seed junk |
| Sync cadence collision | Infloww hourly + ClarioSuite 2h both fire at `:00` even hours; status-log/reassign ride the hourly job | Stagger schedules / daily-gate secondary syncs |
| Large N+1 rewrite for Creator Earnings per-creator sync | Intentional rate-limit pacing | Leave unless Infloww raises limits |

### Empty-states / mobile / error handling (rushed features)

- Applications + Password Library have polished empty/error paths relative to age; no critical gaps found in code skim.
- Stories / unavailable insights already have dedicated empty copy.
- **Needs-decision:** dedicated mobile QA pass on Applications Response Dashboard + Winner Hub group-by-model cards.

---

## 3. Suggested improvements (valuable next steps)

1. **Cross-links:** Password Library ↔ Marketing Control Room already integrated; add Applications → hired candidate → Accounts create flow shortcut.
2. **Notifications:** Confirm Roles UI has Applications alerts enabled for hiring managers (defaults cover admin/manager only). Consider Slack/email digests for `application_submitted`.
3. **Permission review:** Grant `credentials:view` to marketing-exec / VA roles that need Marketing Control Room reveal; keep `credentials:manage` / `applications:manage` tightly held.
4. **ClarioSuite stagger:** Move GHA cron to `15 */2 * * *` to avoid stacking with Infloww at `:00`.
5. **Status log backfill + UI badge:** After backfill, surface disconnection events on Creator Earnings / model detail.
6. **Winner Hub:** Bulk-review filter for `source=auto_detected` + `status=pending` (13 rows waiting).
7. **Index hygiene later:** Advisors list many unused indexes (Airtable legacy) — cleanup pass after confirming read paths, not urgent.

---

## Testing

- Indexes applied via Supabase MCP `apply_migration`.
- `npx tsc --noEmit` / `npm run build` run as part of ship checklist for this commit.
