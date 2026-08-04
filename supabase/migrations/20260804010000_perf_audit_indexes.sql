-- =============================================================================
-- Post-cutover performance indexes (VA Statistics + high-traffic FKs)
-- Safe IF NOT EXISTS; apply_migration wraps in a transaction (no CONCURRENTLY).
-- =============================================================================

-- Punctuality / event digests: event_type + created_at (was Seq Scan ~1.5s on 25k rows)
CREATE INDEX IF NOT EXISTS idx_notifications_event_created
  ON public.notifications (event_type, created_at DESC NULLS LAST);

-- VA / chatter shift range queries (date + staff_role)
CREATE INDEX IF NOT EXISTS idx_shifts_date_staff_role
  ON public.shifts (date, staff_role);

-- shift_models.shift uuid[] overlap lookups (listShiftModelsForShifts)
CREATE INDEX IF NOT EXISTS idx_shift_models_shift_gin
  ON public.shift_models USING gin (shift);

-- Advisor: unindexed foreign keys
CREATE INDEX IF NOT EXISTS idx_client_model_assignments_model_id
  ON public.client_model_assignments (model_id);

CREATE INDEX IF NOT EXISTS idx_custom_request_assignees_user_id
  ON public.custom_request_assignees (user_id);

CREATE INDEX IF NOT EXISTS idx_shift_model_links_model_id
  ON public.shift_model_links (model_id);

CREATE INDEX IF NOT EXISTS idx_sop_role_users_user_id
  ON public.sop_role_users (user_id);

CREATE INDEX IF NOT EXISTS idx_va_content_assignment_vas_user_id
  ON public.va_content_assignment_vas (user_id);

CREATE INDEX IF NOT EXISTS idx_va_task_assignees_user_id
  ON public.va_task_assignees (user_id);

CREATE INDEX IF NOT EXISTS idx_va_task_models_model_id
  ON public.va_task_models (model_id);
