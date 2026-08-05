# Infloww creator earnings sync

Creator/model-level Infloww OpenAPI data — distinct from employee/chatter
`infloww_daily_stats`.

## Env

Same as employee sync:

```
INFLOWW_API_KEY=<raw key>
INFLOWW_AGENCY_OID=<agency OID>
CRON_SECRET=<same as other crons>
```

## Linking models

`modelss.model_id` is an **app-stable** id (`model_…`), **not** the Infloww
creator id. Sync matches `modelss` ↔ Infloww `GET /v1/creators` by:

1. `modelss.model_id` === Infloww creator `id` (if ever stored that way)
2. else `modelss.of_user_id` === creator `platformPid`
3. else unique case-insensitive `model_name` match

Unmatched models are skipped and counted in sync results (`unmatchedModels`).

## Tables (Supabase-only)

| Table | Unique key |
| --- | --- |
| `infloww_creator_daily_stats` | `(creator_infloww_id, date)` |
| `infloww_transactions` | `transaction_id` |
| `infloww_marketing_links` | `(model_id, infloww_link_id)` — `model_id` = modelss public id |
| `infloww_link_fans` | `(link_id, fan_id)` |

Migration: `supabase/migrations/20260806040000_infloww_creator_earnings.sql`.

## Endpoints synced

| Endpoint | Notes |
| --- | --- |
| `GET /v1/transactions` | unix-ms window; status `loading` → re-sync until `done` (~12h) |
| `GET /v1/transaction-perf/details` | unix-ms; 31-day chunks; employee attribution |
| `GET /v1/links` | `CAMPAIGN` / `TRIAL` / `TRACKING` (2–4h Infloww delay) |
| `GET /v1/linkfans` | per link |
| `GET /v1/creator-report/*` | rank, visitors, fans, subscribers, chat-summary |

## Cron cadence

Folded into **`GET /api/cron/sync-infloww-stats`** (same daily Vercel cron).

| Trigger | Schedule | Where |
| --- | --- | --- |
| Vercel (Hobby-safe) | `15 3 * * *` UTC daily | `vercel.json` |
| More frequent | hourly / every-4h | GHA template / external cron (same route) |

**Do not** put hourly schedules in `vercel.json` on Hobby — deploys fail.

Marketing links have 2–4h provider delay; daily sync is enough. Transactions +
creator-report use today+yesterday each run (same as employee section).

Loading transactions: rows with `status=loading` are re-fetched when
`last_loading_sync_at` is null or older than ~12 hours.

## Manual sync

`POST /api/admin/creator-earnings/sync` — requires `earnings:view`.

Body: `{ startYmd?, endYmd?, skipMarketing?, skipTransactions?, skipDailyStats? }`.

## UI

- Admin: `/admin/earnings` (`earnings:view`)
- Model: `/model/earnings` (own `linked_model_id` only)
