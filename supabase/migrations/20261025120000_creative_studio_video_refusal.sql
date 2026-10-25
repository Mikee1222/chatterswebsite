-- Video Analyzer: status + admin raw response + user feedback (no frames/video stored).

ALTER TABLE public.creative_studio_video_analyses
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS raw_model_response text,
  ADD COLUMN IF NOT EXISTS user_feedback text,
  ADD COLUMN IF NOT EXISTS feedback_by text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS feedback_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'creative_studio_video_analyses_status_check'
  ) THEN
    ALTER TABLE public.creative_studio_video_analyses
      ADD CONSTRAINT creative_studio_video_analyses_status_check
      CHECK (status IN ('success', 'refused', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'creative_studio_video_analyses_user_feedback_check'
  ) THEN
    ALTER TABLE public.creative_studio_video_analyses
      ADD CONSTRAINT creative_studio_video_analyses_user_feedback_check
      CHECK (
        user_feedback IS NULL
        OR user_feedback IN ('ok', 'flag_wrong', 'wrong_refusal')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS creative_studio_video_analyses_status_idx
  ON public.creative_studio_video_analyses (model_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS creative_studio_video_analyses_feedback_idx
  ON public.creative_studio_video_analyses (user_feedback, created_at DESC)
  WHERE user_feedback IS NOT NULL;

COMMENT ON COLUMN public.creative_studio_video_analyses.status IS
  'success = usable analysis (participates in duplicate matching). refused/failed = not analysed.';
COMMENT ON COLUMN public.creative_studio_video_analyses.raw_model_response IS
  'Admin-only raw model text for refusal pattern review. Never shown in user UI.';
COMMENT ON COLUMN public.creative_studio_video_analyses.user_feedback IS
  'ok | flag_wrong (success rows) | wrong_refusal (refused rows).';
