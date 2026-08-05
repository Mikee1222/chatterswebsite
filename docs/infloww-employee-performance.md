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

- `GET /v1/employee-report/employee-sales-summary`
- `GET /v1/employee-report/employee-chat-summary`

Params: `platformCode=OnlyFans`, ISO `startTime`/`endTime`, optional `employeeIds`, cursor pagination via `hasMore`/`cursor`. Ranges &gt;31 days are chunked (or day-by-day for attribution).
