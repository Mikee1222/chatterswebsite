-- Atomic "Done" for a reupload: the queue item and the Winners Hub entry change
-- together or not at all (previously two separate updates — a failure of the second
-- left the item "done" with the entry still a trial, and the VA could not retry).

CREATE OR REPLACE FUNCTION public.complete_reupload_atomic(
  p_queue_item_id uuid,
  p_grid_link text,
  p_actor_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.recreation_queue_items%ROWTYPE;
  v_sub public.winner_submissions%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  IF p_queue_item_id IS NULL OR coalesce(trim(p_grid_link), '') = '' THEN
    RAISE EXCEPTION 'Queue item id and grid link are required';
  END IF;

  SELECT * INTO v_item FROM public.recreation_queue_items
  WHERE id = p_queue_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Queue item not found';
  END IF;
  IF v_item.decision <> 'grid' OR v_item.bunch_id IS NOT NULL THEN
    RAISE EXCEPTION 'This item is not in the reupload queue';
  END IF;
  IF v_item.grid_posted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Already marked as reuploaded';
  END IF;

  SELECT * INTO v_sub FROM public.winner_submissions
  WHERE id = v_item.winner_submission_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  UPDATE public.recreation_queue_items
  SET
    grid_posted_at = v_now,
    reupload_url = p_grid_link,
    reupload_done_by = coalesce(p_actor_id, ''),
    original_trial_link = v_sub.video_link,
    original_trial_media_id = v_sub.clariosuite_media_id
  WHERE id = p_queue_item_id;

  -- The card is now the grid post: new link, feed = grid, numbers restart from the new post.
  UPDATE public.winner_submissions
  SET
    video_link = p_grid_link,
    feed = 'grid',
    clariosuite_media_id = NULL,
    posted_at = v_now,
    view_count = 0,
    outlier_multiple = NULL
  WHERE id = v_sub.id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_reupload_atomic(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_reupload_atomic(uuid, text, text) TO service_role;
