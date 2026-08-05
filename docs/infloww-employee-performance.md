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

## Cron

`GET /api/cron/sync-infloww-stats` — daily **03:15 UTC** (`vercel.json`). Syncs the previous Athens calendar day for all linked users.

## Manual backfill

Admin → **Chatter performance** → set From/To (≤366 days lookback) → **Sync now**.

Or:

```bash
curl -X POST "$APP_URL/api/admin/infloww-stats/sync" \
  -H "Cookie: <admin session>" \
  -H "Content-Type: application/json" \
  -d '{"startYmd":"2026-07-01","endYmd":"2026-08-04"}'
```

## Endpoints used

- `GET /v1/employees` — agency employee list (id / name / email / status) for linking accounts
- `GET /v1/employee-report/employee-sales-summary`
- `GET /v1/employee-report/employee-chat-summary`

Employee list: cursor pagination via `cursor`/`limit` (and `hasMore` when present).

Employee reports params: `platformCode=OnlyFans`, date-only `startTime`/`endTime` (`YYYY-MM-DD`), optional `employeeIds`, cursor pagination via `hasMore`/`cursor`. Ranges &gt;31 days are chunked (or day-by-day for attribution).

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
