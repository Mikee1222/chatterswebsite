ALTER TABLE public.winner_videos
  ADD COLUMN IF NOT EXISTS admin_instructions text NOT NULL DEFAULT '';
ALTER TABLE public.recreate_video_slots
  ADD COLUMN IF NOT EXISTS admin_instructions text NOT NULL DEFAULT '';
