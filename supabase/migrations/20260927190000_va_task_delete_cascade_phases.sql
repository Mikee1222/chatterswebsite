-- va_task_phases / va_task_phase_items.task_id is text (Airtable-era), not a FK.
-- Deleting a va_tasks row left orphan checklist rows that Daily Review could still
-- surface via recurring virtual projection. Cascade on delete + one-time cleanup.

DELETE FROM public.va_task_phase_items i
WHERE coalesce(nullif(btrim(i.task_id), ''), '') <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.va_tasks t
    WHERE t.id::text = i.task_id
       OR (t.airtable_id IS NOT NULL AND t.airtable_id = i.task_id)
  );

DELETE FROM public.va_task_phases p
WHERE coalesce(nullif(btrim(p.task_id), ''), '') <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.va_tasks t
    WHERE t.id::text = p.task_id
       OR (t.airtable_id IS NOT NULL AND t.airtable_id = p.task_id)
  );

CREATE OR REPLACE FUNCTION public.cleanup_va_task_phases_on_task_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.va_task_phase_items
  WHERE task_id = OLD.id::text
     OR (
       OLD.airtable_id IS NOT NULL
       AND btrim(OLD.airtable_id) <> ''
       AND task_id = OLD.airtable_id
     );

  DELETE FROM public.va_task_phases
  WHERE task_id = OLD.id::text
     OR (
       OLD.airtable_id IS NOT NULL
       AND btrim(OLD.airtable_id) <> ''
       AND task_id = OLD.airtable_id
     );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_va_tasks_delete_phases ON public.va_tasks;
CREATE TRIGGER trg_va_tasks_delete_phases
BEFORE DELETE ON public.va_tasks
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_va_task_phases_on_task_delete();
