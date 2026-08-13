# vercel.json cron notes

This file exists because `vercel.json` must stay **strict JSON** — `//` comments
break `vercel` CLI (`Couldn't parse JSON file …/vercel.json`).

## Infloww: `/api/cron/sync-infloww-stats`

| Field | Value |
| --- | --- |
| `vercel.json` schedule | `15 3 * * *` (daily 03:15 UTC) |
| Intended product cadence | **Every 2 hours** |
| 2-hourly runner | `.github/workflows/sync-infloww-2h.yml` |
| 2-hourly runner (template) | `docs/github-workflows/sync-infloww-2h.yml` |
| External trigger script | `scripts/trigger-infloww-cron.sh` |

**Why not every-2h in vercel.json?** Team plan is **Vercel Hobby**. Hobby only
allows once-per-day cron schedules. Setting `0 */2 * * *` fails Production
deploys (seen 2026-08-05 in `7e3efb2`; intentionally restored to daily in
`e062844`).

**Why no `//` comment inside vercel.json?** Vercel CLI rejects JSONC
(`Couldn't parse JSON file …/vercel.json`) — notes live here instead.

**Do not** flip Infloww to sub-daily in `vercel.json` unless the team is on Pro
(or another plan that allows more-than-daily crons). Prefer GitHub Actions /
external cron.

Same-day window: route always syncs today+yesterday only (efficient).

## ClarioSuite: `/api/cron/sync-clariosuite`

| Field | Value |
| --- | --- |
| `vercel.json` schedule | `30 4 * * *` (daily 04:30 UTC fallback) |
| Intended product cadence | **Every 2 hours** |
| 2-hourly runner | `.github/workflows/sync-clariosuite-2h.yml` |
| 2-hourly runner (template) | `docs/github-workflows/sync-clariosuite-2h.yml` |
| External trigger script | `scripts/trigger-clariosuite-cron.sh` |

Incremental window: trailing **14 days** of daily insights per account (not a
full historical resync). Audience snapshot + top-25 posts refreshed each run.

Same Hobby constraint as Infloww — sub-daily schedules belong in GHA, not
`vercel.json`.

## Creator earnings (same Infloww cron)

The same `/api/cron/sync-infloww-stats` route also syncs creator-level data
(transactions, creator-report, marketing links) for matched modelss ↔ Infloww
creators. Keep the Vercel schedule **daily**; more frequent needs the GHA path
above.

See `docs/infloww-creator-earnings.md`.
