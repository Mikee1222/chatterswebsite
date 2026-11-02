-- Atomic content-cycle delete.
-- p_delete_bunches = false → unlink bunches (cycle_id NULL), delete cycle only.
-- p_delete_bunches = true  → delete each linked bunch via same steps as
--   delete_video_bunch_atomic (queue items → unassigned pending), then delete cycle.
-- Never touches content_cycle_settings.

CREATE OR REPLACE FUNCTION public.delete_content_cycle_atomic(
  p_cycle_id uuid,
  p_delete_bunches boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF p_cycle_id IS NULL THEN
    RAISE EXCEPTION 'Cycle id required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.content_cycles WHERE id = p_cycle_id) THEN
    RAISE EXCEPTION 'Cycle not found';
  END IF;

  IF p_delete_bunches THEN
    FOR r IN
      SELECT id
      FROM public.video_bunches
      WHERE cycle_id = p_cycle_id
         OR id IN (
           SELECT proven_bunch_id FROM public.content_cycles WHERE id = p_cycle_id AND proven_bunch_id IS NOT NULL
           UNION
           SELECT experimental_bunch_id FROM public.content_cycles WHERE id = p_cycle_id AND experimental_bunch_id IS NOT NULL
         )
    LOOP
      PERFORM public.delete_video_bunch_atomic(r.id);
    END LOOP;
  ELSE
    UPDATE public.video_bunches
    SET cycle_id = NULL
    WHERE cycle_id = p_cycle_id;

    UPDATE public.content_cycles
    SET
      proven_bunch_id = NULL,
      experimental_bunch_id = NULL,
      updated_at = now()
    WHERE id = p_cycle_id;
  END IF;

  DELETE FROM public.content_cycles WHERE id = p_cycle_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_content_cycle_atomic(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_content_cycle_atomic(uuid, boolean) TO service_role;
