# Delta sync — Airtable gap → Supabase

**Status:** COMPLETED (live run 2026-08-04)  
**Project:** `wagfkuxkrgsencartqtx`  
**Script:** `scripts/delta-sync-airtable-gap.ts`

## Gap window

| Bound | Timestamp (UTC) | Timestamp (EEST, UTC+3) | Source |
|-------|-----------------|-------------------------|--------|
| **START** | `2026-08-02T23:28:59.673Z` | 2026-08-03 02:28:59 | First `_airtable_id_map.migrated_at` (bulk migration start, `system_settings`) |
| **END** | `2026-08-03T23:37:00.000Z` | 2026-08-04 02:37:00 | Production cutover (`DATA_BACKEND=supabase`) — see [CUTOVER_EXECUTED.md](./CUTOVER_EXECUTED.md) |

Bulk migration finished ~`2026-08-03T00:15:01Z` (last `_airtable_id_map.migrated_at`, notifications). Production kept writing to Airtable until cutover; this catch-up syncs that gap.

Selection: Airtable `filterByFormula` with `LAST_MODIFIED_TIME()` strictly inside `[START, END)`.

## Safety rules

- Airtable **READ-ONLY** (no creates/updates/deletes).
- If a matching Supabase row has `updated_at >= GAP_END`, **prefer Supabase** — skip overwrite and flag for manual review.
- Reuses original transforms from `scripts/lib/supabase-migrate.ts` (field map, coerce, link remap, attachment upload, join refresh).

## Live run results

**Audit:** `docs/supabase-migration/delta-sync-logs/delta-sync-2026-08-04T00-50-06-756Z.jsonl`  
**Summary:** `…-summary.json`

| Metric | Count |
|--------|------:|
| Gap rows (Airtable) | 616 |
| Inserts | 560 |
| Updates | 55 |
| Conflicts skipped | 1 |
| Table errors | 0 |

`_airtable_id_map`: 40 897 → 41 457 (+560 inserts).

### Per-table (non-zero only)

| Table | Gap | Insert | Update | Conflict |
|-------|----:|-------:|-------:|---------:|
| notifications | 352 | 348 | 4 | 0 |
| va_task_phase_items | 157 | 144 | 13 | 0 |
| shift_models | 25 | 16 | 9 | 0 |
| va_task_phases | 14 | 12 | 2 | 0 |
| activity_logs | 13 | 13 | 0 | 0 |
| shifts | 12 | 8 | 4 | 0 |
| modelss | 9 | 0 | 9 | 0 |
| users | 6 | 0 | 5 | 1 |
| billing_cycles | 4 | 3 | 1 | 0 |
| points_transactions | 4 | 4 | 0 | 0 |
| clients | 3 | 0 | 3 | 0 |
| payment_submissions | 3 | 3 | 0 | 0 |
| weekly_program | 3 | 3 | 0 | 0 |
| va_tasks | 2 | 2 | 0 | 0 |
| payment_methods | 2 | 0 | 2 | 0 |
| chatter_points | 2 | 0 | 2 | 0 |
| model_schedule | 2 | 2 | 0 | 0 |
| billing_cycle_revenues | 1 | 0 | 1 | 0 |
| spin_wheel_spins | 1 | 1 | 0 | 0 |
| model_live_streams | 1 | 1 | 0 | 0 |
| custom_requests | 0 | — | — | — |
| winner_videos | 0 | — | — | — |

Priority tables `custom_requests` and `winner_videos` had **no** gap-window modifications.

### Conflicts (manual review)

| Table | Airtable ID | Supabase ID | Reason |
|-------|-------------|-------------|--------|
| users | `recA62rgP2WK9Jbp2` | `dc6ef0a0-d29a-4099-afe5-5a29a9ece0ba` | `updated_at=2026-08-03T23:55:55.91Z` ≥ cutover — post-cutover Supabase write kept |

### Spot-checks

| Table | Airtable ID | Present in both | `created_time` match |
|-------|-------------|-----------------|----------------------|
| va_tasks | `rec760AlmVf8pXJPR` | yes | yes |
| notifications | `rec042X4lZ2ccipkw` | yes | yes |
| shifts | `rec2HMXOrdv6K905q` | yes | yes |
| va_task_phase_items | `rec08w8SlYu8DB2MT` | yes | yes |

### Tables that could not be synced

None — all 106 planned tables queried successfully. Tables with zero gap rows simply had no Airtable activity in the window (not failures). Gone Airtable tables remain excluded via `MIGRATION_ORDER` / `GONE_AIRTABLE_TABLES`.

## Re-run

```bash
# Dry-run (no writes)
npx tsx scripts/delta-sync-airtable-gap.ts --dry-run

# Priority tables only
npx tsx scripts/delta-sync-airtable-gap.ts --dry-run --priority-only

# Live
npx tsx scripts/delta-sync-airtable-gap.ts

# Subset / no attachment re-upload
npx tsx scripts/delta-sync-airtable-gap.ts --tables notifications,va_tasks --skip-attachments
```

Requires `.env.local`: `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

Idempotent for already-synced gap rows (upsert on `airtable_id`). Post-cutover conflicts continue to be skipped.
