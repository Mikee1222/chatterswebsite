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
creator id. Prefer the dedicated column:

| Field | Meaning |
| --- | --- |
| `modelss.model_id` | App slug (`model_*`) — never use as Infloww id |
| `modelss.infloww_creator_id` | Stable Infloww creator `id` from `GET /v1/creators` |
| `modelss.of_user_id` | OnlyFans user id (TheOnlyAPI) — may differ from Infloww `platformPid` |

Sync match order:

1. **`modelss.infloww_creator_id` === Infloww creator `id`** (preferred, always when set)
2. else `modelss.model_id` === creator `id` (legacy / rare)
3. else `modelss.of_user_id` === creator `platformPid`
4. else unique case-insensitive `model_name` match

Unmatched models are skipped and counted in sync results (`unmatchedModels`).

### Creator ID lookup

Admin UI: `/admin/earnings` → **Creator ID lookup** (same permission as earnings:
`earnings:view`). Copy an id into Accounts → Models → Edit → **Infloww creator ID**.

API: `GET /api/admin/infloww-creators`.

Optional backfill of fuzzy matches:
`npx tsx scripts/backfill-infloww-creator-ids.ts`

### Unmatched models (2026-08-06 audit)

Infloww `/v1/creators` returned **10** creators; **9/18** Gunzo models matched by
name; **9** had no Infloww counterpart (no `of_user_id`, no name/platformPid hit):

| Gunzo model | of_user_id | Why unmatched |
| --- | --- | --- |
| Antigoni | — | Not present in Infloww creators |
| Ariadni | — | Not present in Infloww creators |
| Chrysa | — | Not present in Infloww creators |
| Elisavet | — | Not present in Infloww creators |
| G Antigoni | — | Not present in Infloww creators |
| Gavriela | — | Not present in Infloww creators |
| Katerina K | — | Not present in Infloww creators |
| Stefania | — | Not present in Infloww creators |
| Stella | — | Not present in Infloww creators |

Leftover Infloww creator with no Gunzo model: **Ioanna** (`2482640951508999`).

Matched by name (then backfilled to `infloww_creator_id`): Diana, Eirini, Frika,
Frost, Lina, Lydia, Marillia, Roxana, Silia.

## Tables (Supabase-only)

| Table | Unique key |
| --- | --- |
| `infloww_creator_daily_stats` | `(creator_infloww_id, date)` — includes `fans_with_renew_on` |
| `infloww_transactions` | `transaction_id` |
| `infloww_refunds` | `refund_id` |
| `infloww_priority_mass_messages` | `priority_mass_message_id` |
| `infloww_marketing_links` | `(model_id, infloww_link_id)` — `model_id` = modelss public id |
| `infloww_link_fans` | `(link_id, fan_id)` |

Migrations:

- `supabase/migrations/20260806040000_infloww_creator_earnings.sql`
- `supabase/migrations/20260806050000_modelss_infloww_creator_id.sql`
- `supabase/migrations/20260806060000_infloww_creator_earnings_refunds_pmm.sql`

## Endpoints synced

| Endpoint | Notes |
| --- | --- |
| `GET /v1/transactions` | unix-ms window; status `loading` → re-sync until `done` (~12h) |
| `GET /v1/transaction-perf/details` | unix-ms; 31-day chunks; employee attribution |
| `GET /v1/refunds` | unix-ms; ~1h provider delay; 31-day chunks |
| `GET /v1/priority-mass-messages` | unix-ms; per creator; optional employeeIds |
| `GET /v1/links` | `CAMPAIGN` / `TRIAL` / `TRACKING` (2–4h Infloww delay) |
| `GET /v1/linkfans` | per link |
| `GET /v1/creator-report/*` | rank, visitors, fans, subscribers, chat-summary, renew-on |

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

Body: `{ startYmd?, endYmd?, lookbackDays?, skipMarketing?, skipTransactions?, skipDailyStats? }`.

- `endYmd` is always capped to Infloww-safe today.
- `lookbackDays` (1–366) sets start relative to that fixed end (same as Chatter Performance sync).
- Admin UI: **Sync now** / **Sync Last 3 Months** / **Sync Last Year**.

`fans_with_renew_on` is nullable: Infloww sometimes omits creators from
`/creator-report/fans/renew-on` (notably some high-volume accounts). Missing
rows stay `NULL` (UI shows —) rather than a false 0.0%. The fetch always queries
the full agency creator set then filters — single-creator requests often return
an empty list from Infloww.

## UI

- Admin: `/admin/earnings` (`earnings:view`) + Creator ID lookup
- Model: `/model/earnings` (own `linked_model_id` only)
