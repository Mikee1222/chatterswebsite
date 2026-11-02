-- Atomic video bunch delete: slots + winner_videos + iCloud folders removed;
-- recreation_queue_items returned to unassigned pending queue; bunch row deleted
-- (content_cycles.proven/experimental_bunch_id SET NULL via FK).

CREATE OR REPLACE FUNCTION public.delete_video_bunch_atomic(p_bunch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_bunch_id IS NULL THEN
    RAISE EXCEPTION 'Bunch id required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.video_bunches WHERE id = p_bunch_id) THEN
    RAISE EXCEPTION 'Bunch not found';
  END IF;

  DELETE FROM public.recreate_video_slots WHERE bunch_id = p_bunch_id;
  DELETE FROM public.winner_videos WHERE bunch_id = p_bunch_id;

  UPDATE public.recreation_queue_items
  SET
    bunch_id = NULL,
    decision = 'pending',
    decided_by = '',
    decided_at = NULL
  WHERE bunch_id = p_bunch_id;

  DELETE FROM public.icloud_folder_entries WHERE bunch_id = p_bunch_id;
  DELETE FROM public.video_bunches WHERE id = p_bunch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_video_bunch_atomic(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_video_bunch_atomic(uuid) TO service_role;
