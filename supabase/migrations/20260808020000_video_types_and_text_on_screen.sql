-- Expand Fill Bunches / Hub video types + Other custom text + Text on Screen Suggestion.

-- recreate_video_slots.video_type: Skit / UGC / Text on screen / Interview / Clips / Other
ALTER TABLE public.recreate_video_slots
  DROP CONSTRAINT IF EXISTS recreate_video_slots_video_type_check;

ALTER TABLE public.recreate_video_slots
  ADD CONSTRAINT recreate_video_slots_video_type_check
  CHECK (video_type IN ('', 'skit', 'ugc', 'text_on_screen', 'interview', 'clips', 'other'));

ALTER TABLE public.recreate_video_slots
  ADD COLUMN IF NOT EXISTS video_type_other text NOT NULL DEFAULT '';

-- Persist researcher-selected type on winner_videos (before slot materializes on Approve).
ALTER TABLE public.winner_videos
  ADD COLUMN IF NOT EXISTS sourcing_video_type text NOT NULL DEFAULT '';

ALTER TABLE public.winner_videos
  ADD COLUMN IF NOT EXISTS video_type_other text NOT NULL DEFAULT '';

-- Optional creative-script field (alongside script_text).
ALTER TABLE public.winner_videos
  ADD COLUMN IF NOT EXISTS text_on_screen_suggestion text NOT NULL DEFAULT '';
