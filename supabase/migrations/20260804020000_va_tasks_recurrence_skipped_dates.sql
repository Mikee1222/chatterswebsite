-- Skip dates for recurring VA task series: YYYY-MM-DD Athens days that must not
-- be virtually projected or auto-spawned (this-occurrence-only delete / exception).
ALTER TABLE public.va_tasks
  ADD COLUMN IF NOT EXISTS recurrence_skipped_dates text[] DEFAULT '{}'::text[];

COMMENT ON COLUMN public.va_tasks.recurrence_skipped_dates IS
  'Athens YYYY-MM-DD dates excluded from virtual projection and proactive spawn for this recurring series anchor.';
