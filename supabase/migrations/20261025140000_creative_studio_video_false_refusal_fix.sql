-- Video Analyzer: relabel false-success refusals, add sampling_meta telemetry.

ALTER TABLE public.creative_studio_video_analyses
  ADD COLUMN IF NOT EXISTS sampling_meta jsonb;

COMMENT ON COLUMN public.creative_studio_video_analyses.sampling_meta IS
  'Per-run sampling telemetry: duration, seek timestamps, frame counts/byte lengths, blank replacements, vision model. No pixels/video.';

-- Condition-based: rows that stored refusal:true under status=success (known false refusals).
UPDATE public.creative_studio_video_analyses
SET status = 'refused'
WHERE status = 'success'
  AND (analysis->>'refusal') = 'true';
