# Supabase Production Test Data Cleanup

**Project:** `wagfkuxkrgsencartqtx` (LIVE Production)  
**Date:** 2026-08-04  
**Scope:** Supabase only — **no Airtable writes/deletes**  
**Status:** Inventory written → deletes executed (see Results)

## Safety rules applied

1. Inventory before delete (this doc).
2. Do **not** delete E2E / longstanding test **user accounts**.
3. Skip ambiguous rows (real staff + real schedule/report data).
4. Prefer clearly labeled smoke (`smoke-supabase-local`, `[TEST]`, E2E inbox rows).

## E2E users (KEPT — accounts only)

| Email | UUID | Role |
|-------|------|------|
| `e2e-admin@gunzo.e2e` | `61c07190-2842-42d1-aea3-2a0857e67678` | admin |
| `e2e-chatter@gunzo.e2e` | `0fbba47c-c242-4382-98bd-3b13f32d36fb` | chatter |
| `e2e-model@gunzo.e2e` | `3e7a4098-020c-438f-8d65-addc0efc90e4` | model |
| `e2e-va@gunzo.e2e` | `64e49fa0-bfd1-452c-b66e-ecd8b3600a65` | virtual_assistant |

Also kept (not deleted): `notification_preferences` for these users (needed for future E2E).

Longstanding Airtable-backed accounts named “test” (`test@gmail.com`, `test2@gmail.com`, `test3@gmail.com`) — **accounts kept**. Only Aug 3 native smoke shifts / points attributed to `test` / `Testing Member` are removed.

## Not found (nothing to delete)

| Target | Result |
|--------|--------|
| `[E2E]` VA tasks | **0** (Playwright create likely did not persist) |
| `AUDIT-VIRT*` tasks / recurring series | **0** in Supabase |
| Live stream `recMKYnBIIwqM4DuB` | **0** (no Supabase copy) |
| E2E-assigned `va_tasks` / `va_task_assignees` | **0** |
| Smoke `link_pages` | **0** (analytics only) |

## Planned deletes (clearly test)

| Table | Count | Sample / criteria |
|-------|------:|-------------------|
| `content_item_events` | 8 | Events for content titled `smoke idea` |
| `content_items` | 3 | title `smoke idea` |
| `research_ideas` | 3 | idea_text `smoke idea` |
| `research_bunches` | 3 | Native bunches Aug 3 that spawned smoke ideas (Stefania / by Kostas) |
| `notifications` | 62 | Union: body `smoke-supabase%` OR title `Smoke %` OR `test started/ended` OR `user_id` ∈ E2E UUIDs |
| `points_transactions` | 4 | Points for native Aug 3 `test` shifts (8+25+101+25 pts) |
| `payment_submissions` | 3 | note contains `smoke` |
| `marketing_spot_checks` | 3 | `what_was_wrong = smoke-supabase-local` |
| `marketing_daily_reviews` | 1 | `Smoke daily 2026-08-03` |
| `link_page_analytics` | 3 | `user_agent = smoke-supabase-local` |
| `winner_videos` | 4 | note `smoke-supabase%`, model `Smoke Model*` |
| `custom_requests` | 3 | `Smoke custom request` / `Debug approve` / `smoke_fan_local` |
| `shifts` | 7 | notes `smoke-supabase-local` (3) + chatter `test`/`Testing Member` native Aug 3 (4+3 overlap → 7) |
| `va_tasks` | 1 | `[TEST] without due 1783520371129` (2026-07-08, no phases) |

**Total planned rows ≈ 105** (notifications dominate).

### Sample shift IDs

- Smoke-labeled: `9cb5cdc7…`, `95221ebf…`, `d0ba6000…` (Testing Member, ~1s duration)
- `test` chatter native: `7c4bf3f0…`, `33a1845d…`, `cf5b974b…`, `ad28a92d…`

### Sample winner videos

- `Smoke Model` / `https://example.com/smoke-video` / note `smoke-supabase-local`

## Manual review — DO NOT auto-delete

| Item | Why ambiguous |
|------|----------------|
| `weekly_program` ×18 native rows (Aug 3–4) | Real chatters (Anastasis, George, Edgar) — real schedule after cutover |
| `custom_requests` fan_username=`test` (`rec1QLjt65mKjtQqX`, Jun 2025) | Migrated Airtable row; not migration smoke |
| `winner_videos` “E2E Evi” (`recNedl6T1kJnDO4K`, Jul 30) | Has Airtable id; may be real workflow named E2E |
| Recent non-smoke notifications to real admins (fines, schedule published) | Real production events; only E2E copies removed via E2E `user_id` filter |
| Billing cycles reused by smoke payment proofs | Smoke may have attached to a **real** client cycle — submissions deleted, cycles kept |
| Whether to delete `test@gmail.com` / `test2` / `test3` accounts | Flag only — not deleting accounts |
| Whether to delete E2E `@gunzo.e2e` accounts | Flag only — not deleting accounts |

## Delete order (dependency-safe)

1. `content_item_events` → `content_items` → `research_ideas` → `research_bunches`
2. `notifications`
3. `points_transactions` (shift refs)
4. `payment_submissions`, marketing reviews, `link_page_analytics`
5. `winner_videos`, `custom_requests`
6. `shifts`
7. `va_tasks` (`[TEST]`)

## Reusable script

`scripts/cleanup-supabase-e2e-smoke-data.ts` — dry-run by default; `--execute` to apply.

## Results (post-execute)

Executed 2026-08-04 via Supabase SQL on `wagfkuxkrgsencartqtx`.

| Table | Deleted |
|-------|--------:|
| `content_item_events` | 8 |
| `content_items` | 3 |
| `research_ideas` | 3 |
| `research_bunches` | 3 |
| `notifications` | 62 |
| `points_transactions` | 4 |
| `payment_submissions` | 3 |
| `marketing_spot_checks` | 3 |
| `marketing_daily_reviews` | 1 |
| `link_page_analytics` | 3 |
| `winner_videos` | 4 |
| `custom_requests` | 3 |
| `shifts` | 7 |
| `va_tasks` | 1 |
| **Total** | **108** |

Post-verify: all smoke/E2E residual counts = 0. E2E user accounts still present (4).
