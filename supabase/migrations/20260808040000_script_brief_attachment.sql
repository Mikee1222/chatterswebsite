-- Creative script brief: optional PDF/image attachment (direct-to-Storage sb:// token).

ALTER TABLE public.winner_videos
  ADD COLUMN IF NOT EXISTS script_brief_attachment_url text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.winner_videos.script_brief_attachment_url IS
  'Optional brief file (PDF/image) as sb://attachments/… token; signed on read for admin review + filmer Shoot Assignments.';
