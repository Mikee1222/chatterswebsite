# Infloww employee performance sync

## Env (Vercel)

```
INFLOWW_API_KEY=<raw key, no Bearer>
INFLOWW_AGENCY_OID=<agency OID>
CRON_SECRET=<same as other crons>
```

Auth headers: `Authorization: <API key>` and `x-oid: <OID>`.

## Link chatters

Accounts → edit user → **Infloww employee ID** (numeric). Stored as `users.infloww_employee_id`.

To find IDs: Admin → **Chatter performance** → **Employee ID lookup** table (live `GET /v1/employees`). Requires `INFLOWW_API_KEY` + `INFLOWW_AGENCY_OID` in Vercel env.

## Historical backfill (executed 2026-08-05)

Production one-shot via `scripts/backfill-infloww-90d.ts` (Athens `2026-05-08` → `2026-08-05`):

| Chatter | Rows upserted (post-sync count) | Distinct days | Span |
| --- | --- | --- | --- |
| Edgar | 696 | 87 | 2026-05-08 → 2026-08-05 |
| test | 553 | 75 | 2026-05-21 → 2026-08-05 |
| **Total** | **1249** | **90 calendar days covered** | |

Sync reported `rowsUpserted: 1246` (exact upsert count), `errors: 0`. ~12 API requests (2 employees × 3×31-day chunks × sales+chat).

## Cron

`GET /api/cron/sync-infloww-stats` — **hourly** at minute 15 UTC (`15 * * * *` in `vercel.json`).

Each run syncs **today + yesterday** (Athens calendar) for all linked users so late Infloww updates are caught. Upsert key `(user_id, infloww_performer_id, date)` overwrites same-day rows.

### Expected API volume (hourly)

With 31-day chunking and dates present on API rows: **1 chunk × 2 endpoints (sales + chat) × N linked chatters**.

| Linked chatters (N) | Requests / hourly run | vs 1000 req/min |
| --- | --- | --- |
| 2 (current) | ~4 | Safe |
| 50 | ~100 | Safe |
| 200 | ~400 | Safe (still under 1000/min; default spacing 200ms ≈ 300 req/min) |

## Manual / historical backfill

Admin → **Chatter performance** → Custom range → **Sync now**.

One-time ~90-day Production backfill (local, uses prod env):

```bash
vercel env pull .env.production.local --environment production --yes
npx tsx scripts/backfill-infloww-90d.ts
```

Or:

```bash
curl -X POST "$APP_URL/api/admin/infloww-stats/sync" \
  -H "Cookie: <admin session>" \
  -H "Content-Type: application/json" \
  -d '{"startYmd":"2026-05-08","endYmd":"2026-08-05"}'
```

Employee reports: ranges &gt;31 days are auto-chunked. Day-by-day fallback only if API rows omit dates.

## Weekly Progress (admin)

Admin → **Chatter performance** → **Weekly Progress** tab (`infloww_stats:view_all` only — not on My Performance).

Custom 4 weeks per Athens calendar month (not ISO):

| Week | Days |
| --- | --- |
| 1 | 1–7 |
| 2 | 8–14 |
| 3 | 15–21 |
| 4 | 22–end of month (28/29/30/31) |

Util: `lib/infloww-custom-weeks.ts` → `getCustomWeekBoundaries(year, month)`. Aggregates `infloww_daily_stats` via `getAdminWeeklyProgressReport` in `services/infloww-performance.ts`. Rule-based insight tags from `generateWeeklyInsights` in `services/infloww-analytics.ts`. API: `GET /api/infloww-stats?view=weekly_progress&year=&month=`.

## Endpoints used

- `GET /v1/employees` — agency employee list (id / name / email / status) for linking accounts
- `GET /v1/employee-report/employee-sales-summary`
- `GET /v1/employee-report/employee-chat-summary`

Employee list: cursor pagination via `cursor`/`limit` (and `hasMore` when present).

Employee reports params: `platformCode=OnlyFans`, date-only `startTime`/`endTime` (`YYYY-MM-DD`), optional `employeeIds`, cursor pagination via `hasMore`/`cursor`. Ranges &gt;31 days are auto-chunked (31-day windows). Day-by-day fallback only when response rows omit dates.

Response shape notes (sales-summary):
- Rows live under `data.list` (not a bare `data` array)
- Performer id field is `platformPid`
- Money fields are `salesAmount`, `ppvSalesAmount`, `tipsSalesAmount`, `directMessageSalesAmount`, `priorityMassMessageSalesAmount`, `massMessageSalesAmount` — **cents**, converted to dollars on ingest

## Derived analytics (`services/infloww-analytics.ts`)

Shared compute for Admin Chatter Performance + My Performance:

| Metric | Source / notes |
| --- | --- |
| Revenue / hour | Sales ÷ shift hours; null unless ≥1h shifted in range |
| Conversion funnel | messages → PPVs sent → fans_who_spent → revenue |
| Avg PPV price | ppv_sales ÷ ppvs_sent |
| Avg tip size | tips ÷ tip day×creator rows (Infloww lacks tip event count) |
| Rev / fan | sales ÷ fans_chatted |
| Fan CVR | fans_who_spent ÷ fans_chatted (often 0% — field sparse in sync) |
| WoW / period change | Equal-length prior window |
| Personal best | Best day + ISO week from all-time synced rows |
| Team percentile | Rank by sales among linked chatters with sales&gt;0; needs ≥3 |
| Consistency | 0–100 from daily sales CV (≥3 active days) |
| Whale suggestions | High-value rebills (≥$50) whose username is not in Whales — **suggest only** |
| Rebill ↔ sales | Pearson across chatters when n≥4; else deferred note |
| ROI | Admin-only (`includeRoi`); needs compensation on user |

### Deferred / sparse data (Edgar sample Aug 2026)

- **Fan CVR / unlock stage**: `fans_who_spent` is often 0 in synced rows (confirmed agency-wide sum = 0). Calc is correct (`fans_who_spent ÷ fans_chatted` / `÷ ppvs_sent`) — zeros are sparse Infloww data, not a denom bug. Funnel unlock shows n/a when sparse.
- **Whale auto-flag from Infloww**: no fan-level IDs in `infloww_daily_stats` — cannot auto-suggest OF usernames from sales sync alone
- **Rebill retention correlation**: needs ≥4 chatters with both rebills + sales; otherwise UI shows “data doesn’t support cleanly”
- **Performer names**: employee-report uses `platformPid` (no name). Resolve via Infloww `/creators.platformPid` → name, preferring `modelss.model_name` when `modelss.model_id` matches the Infloww creator id. Fallback `Creator {id}`; performer_id `0` → **Unattributed** (pinned last).
- **Rev / hour**: requires ≥1 shift hour in range; otherwise “Not enough shift data”
- **Team standing**: only when ≥3 chatters have sales &gt; 0 in range
