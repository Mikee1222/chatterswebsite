-- Optional 3-tier emoji quality rating on Research Manage approve
-- (👍 good / 🌟 excellent / 🔥 fire). Visible to the submitting researcher.

ALTER TABLE public.winner_videos
  ADD COLUMN IF NOT EXISTS quality_rating text;

ALTER TABLE public.winner_videos
  DROP CONSTRAINT IF EXISTS winner_videos_quality_rating_check;

ALTER TABLE public.winner_videos
  ADD CONSTRAINT winner_videos_quality_rating_check
  CHECK (quality_rating IS NULL OR quality_rating IN ('good', 'excellent', 'fire'));

COMMENT ON COLUMN public.winner_videos.quality_rating IS
  'Optional quality rating on approve: good (👍), excellent (🌟), or fire (🔥).';
