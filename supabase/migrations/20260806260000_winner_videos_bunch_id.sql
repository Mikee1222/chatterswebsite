-- Link Research winner_videos submissions to Winner sourcing bunches.
-- Fill Bunches creates Pending winner_videos with bunch_id; Approve creates recreate_video_slots.

ALTER TABLE public.winner_videos
  ADD COLUMN IF NOT EXISTS bunch_id uuid REFERENCES public.video_bunches (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bunch_name text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_winner_videos_bunch_id
  ON public.winner_videos (bunch_id)
  WHERE bunch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_winner_videos_bunch_pending
  ON public.winner_videos (bunch_id, status)
  WHERE bunch_id IS NOT NULL AND status = 'Pending';
