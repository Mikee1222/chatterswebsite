-- =============================================================================
-- Health-check audit (2026-08-26): safe missing indexes
-- - Unindexed FKs flagged by Supabase advisors (ClarioSuite account joins)
-- - Task timer reporting filters on started_at (+ va_id)
-- - Top-posts insight retry / date filters used by sync + Weekly Progress
-- Safe IF NOT EXISTS; apply_migration wraps in a transaction (no CONCURRENTLY).
-- =============================================================================

-- Advisor: unindexed foreign keys on ClarioSuite account-scoped tables
CREATE INDEX IF NOT EXISTS clariosuite_top_posts_account_id_idx
  ON public.clariosuite_top_posts (clariosuite_model_account_id)
  WHERE clariosuite_model_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS clariosuite_daily_insights_account_id_idx
  ON public.clariosuite_daily_insights (clariosuite_model_account_id)
  WHERE clariosuite_model_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS clariosuite_audience_snapshots_account_id_idx
  ON public.clariosuite_audience_snapshots (clariosuite_model_account_id)
  WHERE clariosuite_model_account_id IS NOT NULL;

-- Task Timer reporting: computeCategoryTimeStats filters started_at ± optional va_id
CREATE INDEX IF NOT EXISTS idx_tcte_va_started_at
  ON public.task_category_time_entries (va_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_tcte_started_at
  ON public.task_category_time_entries (started_at DESC);

-- Password Library: tree/list often filters model + category together
CREATE INDEX IF NOT EXISTS credential_entries_model_category_idx
  ON public.credential_entries (model_id, category);

-- ClarioSuite sync retries rows with missing insights; Weekly Progress sorts by posted_at
CREATE INDEX IF NOT EXISTS clariosuite_top_posts_insights_retry_idx
  ON public.clariosuite_top_posts (ig_user_id, synced_at DESC)
  WHERE insights_available = false OR insights_error IS NOT NULL;

CREATE INDEX IF NOT EXISTS clariosuite_top_posts_posted_at_idx
  ON public.clariosuite_top_posts (posted_at DESC NULLS LAST);

-- Sales reassignments: filter/audit by after employee
CREATE INDEX IF NOT EXISTS infloww_sales_reassignments_after_employee_idx
  ON public.infloww_sales_reassignments (after_employee_id)
  WHERE after_employee_id IS NOT NULL;
