-- Content flow handoffs.
-- 1) Editing and posting briefs can belong to one bunch slot (the idea whose recording brief
--    the Creative Director submits in Scripts to Write). They stay draft until the Head of
--    Marketing approves that recording brief, then go live together.
-- 2) The iCloud manager confirms the raw footage is sorted before the editor starts.
-- 3) The Marketing Manager tells the VAs when a bunch's videos are ready to post.

ALTER TABLE public.editing_briefs
  ADD COLUMN IF NOT EXISTS winner_video_id text;
ALTER TABLE public.posting_briefs
  ADD COLUMN IF NOT EXISTS winner_video_id text;

CREATE INDEX IF NOT EXISTS editing_briefs_winner_video_id_idx
  ON public.editing_briefs (winner_video_id) WHERE winner_video_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS posting_briefs_winner_video_id_idx
  ON public.posting_briefs (winner_video_id) WHERE winner_video_id IS NOT NULL;

ALTER TABLE public.video_bunches
  ADD COLUMN IF NOT EXISTS raw_sorted_at timestamptz,
  ADD COLUMN IF NOT EXISTS raw_sorted_by text NOT NULL DEFAULT '';
