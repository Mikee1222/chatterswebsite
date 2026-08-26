# GetMySocial link-in-bio analytics

## Auth
- Env: `GETMYSOCIAL_API_KEY` (Vercel Production + local)
- Header: `Authorization: Bearer gms_live_…`
- Also accepted by API: `X-API-Key`
- Rate limits (response headers): **120/min**, **10_000/day**
- Connectivity check: `GET /v3/_ping` → `{ ok, user_id, request_id }`
- Service meta: `GET https://api.getmysocial.com/` → `{ service, version, docs }`

## Verified endpoints (v3)
- `GET /v3/links` — paginated `has_more` / `next_cursor`
- `GET /v3/analytics/overview` — `link_id` | `link_ids[]` | `team_id`; `timeframe` **or** `start_date`+`end_date`
- `GET /v3/analytics/links`, `/visitors`, `/time-series`, `/buttons/time-series`, `/referrers`, `/shield`, `/ctr?link_id=`
- `GET /v3/analytics/breakdowns/{countries|regions|cities|devices|browsers|languages|custom-domains}`
- `GET /v3/analytics/tracking-params` (+ `/{name}/time-series?value=` / `export.csv`)

Timeframe values: `today`, `yesterday`, `thisWeek`, `lastWeek`, `thisMonth`, `lastMonth`, `allTime`.

## App wiring
- Tables: `getmysocial_links`, `getmysocial_daily_analytics`, `getmysocial_referrers`, `getmysocial_breakdowns`, `getmysocial_visitor_events` (90d)
- Cron: `/api/cron/sync-getmysocial` · GH Actions every 2h (`sync-getmysocial-2h.yml`) · daily Vercel fallback
- Admin UI: Marketing → Instagram Insights → **Link Funnel** tab
- Model UI: Earnings → link-in-bio card
- Linking: Accounts → Models → Integrations → GetMySocial Link A/B
- Seed: `npx tsx scripts/seed-getmysocial-links.ts`
