-- Prevent duplicate checklist items within a phase and duplicate phase_numbers per task.
-- Closes concurrent clonePhasesToTask races that 7a7c4dd only guarded at app level (TOCTOU).
-- Recurring task-row uniqueness remains on va_tasks_recurring_spawn_key_unique (976839f);
-- this migration hardens the phase/item clone path that still raced / re-cloned after that fix.

CREATE UNIQUE INDEX IF NOT EXISTS va_task_phase_items_phase_sort_unique
  ON public.va_task_phase_items (phase_id, sort_order)
  WHERE phase_id IS NOT NULL AND phase_id <> '' AND sort_order IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS va_task_phases_task_phase_number_unique
  ON public.va_task_phases (task_id, phase_number)
  WHERE task_id IS NOT NULL AND task_id <> '' AND phase_number IS NOT NULL;

-- Reject recurring inserts/updates that omit spawn key (NULL bypasses the partial unique index).
CREATE OR REPLACE FUNCTION public.va_tasks_require_recurring_spawn_key()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_recurring IS TRUE AND (NEW.recurring_spawn_key IS NULL OR btrim(NEW.recurring_spawn_key) = '') THEN
    RAISE EXCEPTION 'recurring_spawn_key required when is_recurring=true'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_va_tasks_require_recurring_spawn_key ON public.va_tasks;
CREATE TRIGGER trg_va_tasks_require_recurring_spawn_key
  BEFORE INSERT OR UPDATE OF is_recurring, recurring_spawn_key
  ON public.va_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.va_tasks_require_recurring_spawn_key();

CREATE OR REPLACE FUNCTION public.va_task_clone_lock(p_task_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_lock(hashtext('va_task_clone:' || COALESCE(p_task_id, '')));
END;
$$;

CREATE OR REPLACE FUNCTION public.va_task_clone_unlock(p_task_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_unlock(hashtext('va_task_clone:' || COALESCE(p_task_id, '')));
END;
$$;

GRANT EXECUTE ON FUNCTION public.va_task_clone_lock(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.va_task_clone_unlock(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.va_task_clone_lock(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.va_task_clone_unlock(text) TO authenticated;
