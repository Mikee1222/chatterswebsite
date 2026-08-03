-- Pipeline / winner-library fields used by winner-recreates dual-backend
ALTER TABLE public.winner_videos
  ADD COLUMN IF NOT EXISTS winner_tier text,
  ADD COLUMN IF NOT EXISTS recreate_count numeric,
  ADD COLUMN IF NOT EXISTS pipeline_elements text,
  ADD COLUMN IF NOT EXISTS assigned_creator_id text,
  ADD COLUMN IF NOT EXISTS content_item_ids text;

CREATE INDEX IF NOT EXISTS idx_winner_videos_winner_tier
  ON public.winner_videos (winner_tier)
  WHERE winner_tier IS NOT NULL;
