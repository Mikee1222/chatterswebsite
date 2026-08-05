# vercel.json cron notes

This file exists because `vercel.json` must stay **strict JSON** — `//` comments
break `vercel` CLI (`Couldn't parse JSON file …/vercel.json`).

## Infloww: `/api/cron/sync-infloww-stats`

| Field | Value |
| --- | --- |
| `vercel.json` schedule | `15 3 * * *` (daily 03:15 UTC) |
| Intended product cadence | **Hourly** |
| Hourly runner (template) | `docs/github-workflows/sync-infloww-hourly.yml` → copy to `.github/workflows/` |
| Hourly runner (script) | `scripts/trigger-infloww-cron.sh` (any external cron) |

**Why not hourly in vercel.json?** Team plan is **Vercel Hobby**. Hobby only
allows once-per-day cron schedules. Setting `15 * * * *` fails Production
deploys (seen 2026-08-05 in `7e3efb2`; intentionally restored to daily in
`e062844`).

**Why no `//` comment inside vercel.json?** Vercel CLI rejects JSONC
(`Couldn't parse JSON file …/vercel.json`) — notes live here instead.

**Do not** flip Infloww to hourly in `vercel.json` unless the team is on Pro
(or another plan that allows more-than-daily crons). Prefer GitHub Action /
external cron.

Same-day window: route always syncs today+yesterday only (efficient).
