-- Idempotent recurring occurrence spawn: one real row per series + Athens due day.
-- Closes serverless cross-instance races (page load + shift start + cron) that duplicated
-- same-day va_tasks rows within milliseconds and cloned phases twice.

ALTER TABLE public.va_tasks
  ADD COLUMN IF NOT EXISTS recurring_spawn_key text;

COMMENT ON COLUMN public.va_tasks.recurring_spawn_key IS
  'Stable key title+assignees+models+Athens due YMD — unique per recurring occurrence for spawn idempotency.';

-- Backfill keeper row per duplicate group (earliest created_at wins the key).
-- Uses chr(30) record separator (same as buildRecurringSpawnKey in lib/recurrence.ts).
-- Assignees resolve to users.airtable_id to match vaTaskSeriesKey() in application code.
WITH keyed AS (
  SELECT
    vt.id,
    (
      COALESCE(vt.title, '')
      || chr(30)
      || COALESCE(
          (
            SELECT string_agg(COALESCE(u.airtable_id, u.id::text), ',' ORDER BY COALESCE(u.airtable_id, u.id::text))
            FROM unnest(COALESCE(vt.assigned_to, '{}'::uuid[])) AS uid
            JOIN public.users u ON u.id = uid
          ),
          ''
        )
      || chr(30)
      || COALESCE(
          (
            SELECT string_agg(trim(m), ',' ORDER BY trim(m))
            FROM unnest(string_to_array(COALESCE(vt.assigned_model_ids, ''), ',')) AS m
            WHERE trim(m) <> ''
          ),
          ''
        )
      || chr(30)
      || to_char(vt.due_date AT TIME ZONE 'Europe/Athens', 'YYYY-MM-DD')
    ) AS spawn_key,
    ROW_NUMBER() OVER (
      PARTITION BY
        COALESCE(vt.title, ''),
        COALESCE(
          (
            SELECT string_agg(COALESCE(u.airtable_id, u.id::text), ',' ORDER BY COALESCE(u.airtable_id, u.id::text))
            FROM unnest(COALESCE(vt.assigned_to, '{}'::uuid[])) AS uid
            JOIN public.users u ON u.id = uid
          ),
          ''
        ),
        COALESCE(
          (
            SELECT string_agg(trim(m), ',' ORDER BY trim(m))
            FROM unnest(string_to_array(COALESCE(vt.assigned_model_ids, ''), ',')) AS m
            WHERE trim(m) <> ''
          ),
          ''
        ),
        to_char(vt.due_date AT TIME ZONE 'Europe/Athens', 'YYYY-MM-DD')
      ORDER BY vt.created_at NULLS LAST, vt.id
    ) AS rn
  FROM public.va_tasks vt
  WHERE vt.is_recurring = TRUE AND vt.due_date IS NOT NULL
)
UPDATE public.va_tasks t
SET recurring_spawn_key = k.spawn_key
FROM keyed k
WHERE t.id = k.id AND k.rn = 1;

CREATE UNIQUE INDEX IF NOT EXISTS va_tasks_recurring_spawn_key_unique
  ON public.va_tasks (recurring_spawn_key)
  WHERE recurring_spawn_key IS NOT NULL AND is_recurring = TRUE;
