-- App uses comma-separated model id/name text fields + overdue_notified_at (Airtable scalars).
-- Join table va_task_models remains for PK-based links; text cols keep dual-run parity with Airtable.
ALTER TABLE public.va_tasks
  ADD COLUMN IF NOT EXISTS assigned_model_ids text,
  ADD COLUMN IF NOT EXISTS assigned_model_names text,
  ADD COLUMN IF NOT EXISTS overdue_notified_at timestamptz;

COMMENT ON COLUMN public.va_tasks.assigned_model_ids IS
  'Comma-separated model airtable/public ids (Airtable parity); prefer va_task_models for new writes';
