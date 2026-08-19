-- Per-item task timer: link time entries to individual checklist items.
-- Prior rows were negligible test data (2 rows) — cleared before NOT NULL constraint.

DELETE FROM public.task_category_time_entries;

ALTER TABLE public.task_category_time_entries
  ADD COLUMN IF NOT EXISTS task_phase_item_id text;

ALTER TABLE public.task_category_time_entries
  ALTER COLUMN task_phase_item_id SET NOT NULL;

COMMENT ON COLUMN public.task_category_time_entries.task_phase_item_id IS
  'va_task_phase_items.id — one timing session per checklist item';

CREATE INDEX IF NOT EXISTS idx_tcte_task_phase_item_id
  ON public.task_category_time_entries (task_phase_item_id);

-- Policy: at most one active (un-ended) timer per VA at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tcte_one_active_per_va
  ON public.task_category_time_entries (va_id)
  WHERE ended_at IS NULL;
