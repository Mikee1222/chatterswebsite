# Supabase Migration — Flagged Services

Services listed here have NOT been dual-backed in the current pass and remain
Airtable-only. Each entry explains *why* the service was flagged and what a
proper migration would require. When these are eventually dual-backed, the
guard pattern (`if (isSupabaseBackend())`) can be added to each exported async
function following the same pattern as the completed services.

DATA_BACKEND default remains `"airtable"`; toggling to `"supabase"` on staging
will continue to route these flagged services to Airtable via their unchanged
implementations. No data-loss risk from the current partial cutover, but note
that flipping the flag will produce mixed reads/writes across backends until
these are also migrated.

---

## Group 1 — Complex orchestrators (must be dual-backed AFTER all dependencies)

### `services/content-items.ts` (567 lines)
- **Why flagged:** Core pipeline state machine — spawn, stage transitions, QA,
  assignment resolution. Every new "recreate" or "research" idea passes through
  here. Depends on: `creator-assignments`, `modelss`, `users`, `notifications`,
  `notification-service`, `permissions`.
- **What's needed:** A `content-items-supabase.ts` mirroring every stage
  transition helper with linked-uuid resolution for `assigned_user`,
  `creator_model`, and `research_idea` links. Because this is a pipeline
  state machine, it must be tested end-to-end (all six stages) before flipping
  the backend flag.

### `services/custom-requests.ts` (551 lines) + `services/custom-request-agency-queue.ts` (201 lines)
- **Why flagged:** Custom request workflow with notification cascades to
  agency queue, VA notify, admin review, and points engine integration.
  Multiple downstream services expect specific field snapshots. Airtable
  formula-heavy for date-range filters.
- **What's needed:** `custom-requests-supabase.ts` with `admin_only` /
  `assigned_party_only` notification routing preserved. Because
  `patchCustomRequestRecord` is called from `custom-request-agency-queue.ts`
  as a shared helper, the agency-queue guards depend on `custom-requests`
  being dual first.

### `services/marketing-reviews.ts` (587 lines)
- **Why flagged:** Multi-table service (spot checks + daily reviews +
  executive audits) with Airtable attachment uploads and complex
  notification logic. Attachment field (`uploadAirtableAttachment`) is
  intentionally out of scope for the Supabase migration until an S3/R2
  bucket is provisioned.
- **What's needed:** Attachment storage decision first, then a
  `marketing-reviews-supabase.ts` that mirrors the review-type union.

### `services/link-pages.ts` (751 lines) + `services/link-ab-testing.ts` (446 lines) + `services/link-page-analytics.ts` (734 lines)
- **Why flagged:** These three files form a single sub-system.
  `link-pages.ts` uses Next.js `unstable_cache` + `revalidateTag` for
  edge-cache invalidation of public link pages; those tag calls need to be
  preserved regardless of backend. `link-ab-testing.ts` depends on
  `link-pages` write helpers (createLinkPage / updateLinkPage / archive).
  `link-page-analytics.ts` reads event tables and does heavy aggregation.
- **What's needed:** Migrate as one coordinated PR — `link-pages-supabase`
  first, then A/B and analytics on top. `link-redirects.ts` (already
  dual-backed) is standalone and independent.

## Group 2 — External-system integrators (need architectural review)

### `services/of-sync.ts` (472 lines)
- **Why flagged:** Syncs OnlyFans subscriber data from an external
  MCP-provided API into Airtable. Uses `batchCreateRecords` /
  `batchUpdateRecords` with Airtable-specific rate limiting. A Supabase
  variant would replace the batch shape with Postgres upserts and drop
  the Airtable read-cache invalidation calls.
- **What's needed:** Rewrite around Postgres `upsert` semantics; not a
  drop-in mapping.

## Group 3 — Cross-service orchestrators (delegate to dual services)

### `services/accounts-delete.ts` (242 lines) + `services/force-delete-cascade.ts` (258 lines)
- **Why flagged:** These call `listAllRecords` / `deleteRecord` /
  `updateRecord` directly across ~20 different Airtable tables in a
  cascade delete. Every table they touch must be dual-backed first, and
  the cascade order matters for foreign-key integrity in Postgres.
- **What's needed:** Wait until ALL touched tables are dual-backed, then
  replace direct `listAllRecords` calls with the dual-backed service
  functions. Postgres FK constraints will enforce the cascade automatically
  once the schema is fully migrated.

### `services/cron-notification-jobs.ts` (627 lines)
- **Why flagged:** Multiple cron jobs that scan `notifications`,
  `va_task_phases`, `va_task_phase_items`, and other tables directly.
  Most of what it reads is already served by dual-backed services
  (notifications, va-tasks, shifts), but a handful of direct
  `listAllRecords` calls remain (e.g. availability-reminder scan).
- **What's needed:** Replace remaining direct table reads with the
  dual-backed service functions. No `-supabase.ts` file needed — this is
  a pure orchestrator.

### `services/va-statistics.ts` (618 lines)
- **Why flagged:** Aggregates VA task + shift performance. Reads
  directly from `va_task_phase_items` and `notifications` tables.
  Depends on `getAllVaTasks` and `listAllShifts` (already dual).
- **What's needed:** Move the two remaining direct table reads into
  dual-backed helpers (either extend `va-tasks.ts` or add a small
  `va-task-phase-items-supabase.ts`), then delete the direct calls here.

### `services/client-portal.ts` (1135 lines)
- **Why flagged:** Largest service in the codebase. Aggregates data
  across models, subscribers, transactions, whales, custom requests,
  fines/bonuses, marketing reviews, and more into a single client-facing
  read API. Because it's read-heavy and touches ~10 tables, dual-backing
  requires every downstream service to be dual first.
- **What's needed:** Same as `accounts-delete.ts` — wait for downstream
  coverage, then flip. No writes originate from this file.

## Group 4 — Analytics / diagnostics (small, but read-heavy)

### `services/pipeline-analytics.ts` (98 lines)
- **Why flagged:** Reads `content_item_events`, `content_items`, and
  `research_bunches` via `listAllRecords`. `content_items` and
  `research_bunches` are dual-backed in this pass BUT
  `content_item_events` is not (it's an event log table with no direct
  CRUD service — writes happen inline from `content-items.ts`).
- **What's needed:** Add a small `content-item-events-supabase.ts`
  reader for that one table, then dual `pipeline-analytics.ts`.

### `services/points-debug-audit.ts` (210 lines)
- **Why flagged:** Admin-only diagnostic helpers that audit
  `points_transactions`, `users`, and related tables. Because
  `points-engine.ts` and `users.ts` are already dual, most of this is
  tractable, but a proper migration should preserve the exact
  audit-log semantics (which surface duplicate transactions and
  incorrect levels). Not user-facing — safe to leave Airtable-only.
- **What's needed:** Low-priority. Can be flipped later when doing a
  full points-engine QA pass on Supabase.

### `services/winner-recreates.ts` (148 lines)
- **Why flagged:** Depends on `spawnContentItem` from `content-items.ts`
  (flagged above) and reads `winner_videos` directly. Because
  `winner-videos.ts` IS dual-backed, the winner side is fine, but the
  spawn side inherits `content-items`' flag.
- **What's needed:** Automatic once `content-items.ts` is dual —
  no `-supabase.ts` companion needed here since it just orchestrates
  other services.

## Group 5 — Not-yet-covered CRUD services

### `services/va-content-assignments.ts` (968 lines)
- **Why flagged:** Largest remaining CRUD service. Complex assignment
  matrix logic (content items × VAs × phases × content-types) with
  scoring/rotation heuristics. Straightforward to dual-back structurally
  but time-intensive.
- **What's needed:** Direct dual-backing following the same pattern as
  `chatter-mistakes-supabase.ts` — mirror each helper.

### `services/weekly-availability-requests.ts` (376 lines) + `services/weekly-availability-requests-models.ts` (259 lines)
- **Why flagged:** Chatter and model variants of the availability
  system. The VA variant (`weekly-availability-requests-va.ts`) is
  dual-backed in this pass; the two others follow the same shape and
  should be dual in the next batch.
- **What's needed:** Copy `weekly-availability-requests-va-supabase.ts`
  and adapt tables/link fields (chatter → chatter, model → model_id).

## Summary — Coverage after this pass

| Service | Status |
|---|---|
| sops, sop-quiz, sop-progress | ✅ Dual |
| chatter-mistakes | ✅ Dual |
| pricing | ✅ Dual |
| pdf-maker | ✅ Dual |
| model-periods (CRUD tier) | ✅ Dual |
| creator-assignments | ✅ Dual |
| video-transcripts | ✅ Dual (attachments intentionally stay Airtable) |
| research-bunches | ✅ Dual (but depends on flagged content-items) |
| link-redirects | ✅ Dual |
| weekly-availability-requests-va | ✅ Dual |
| **All Group 1–5 above** | ⏸ **Airtable-only (this doc)** |

## Staging readiness note

Flipping `DATA_BACKEND=supabase` on staging is safe for reads/writes to any
of the ✅ services above. Every ⏸ flagged service will continue to hit
Airtable via its unchanged path, so no request will fail — but writes will
be split across both backends until the flagged services are also dual.

Recommended cutover order:
1. Dual-back Group 5 (va-content-assignments, weekly-availability-requests +
   -models) — pure CRUD, mechanical.
2. Dual-back Group 1 sub-systems (content-items → then custom-requests →
   then marketing-reviews → then link-pages+A/B+analytics).
3. Address Group 3 orchestrators (accounts-delete / force-delete-cascade /
   client-portal / cron-notification-jobs / va-statistics) — these become
   trivial once their dependencies are dual.
4. Group 4 analytics files last (small, low-risk).
5. `of-sync.ts` (Group 2) is standalone and can be scheduled independently
   whenever the OF subscriber pipeline is ready to move to Postgres.
