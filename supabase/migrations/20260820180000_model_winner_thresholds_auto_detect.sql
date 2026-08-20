-- Per-model Winner / Super Winner view thresholds + auto-detect columns on winner_submissions.
-- Threshold changes are NOT retroactive: already-classified posts keep their tier forever.

CREATE TABLE IF NOT EXISTS public.model_winner_thresholds (
  model_id text PRIMARY KEY,
  winner_threshold_views integer NOT NULL DEFAULT 100000
    CHECK (winner_threshold_views >= 0),
  super_winner_threshold_views integer NOT NULL DEFAULT 300000
    CHECK (super_winner_threshold_views >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT '',
  CONSTRAINT model_winner_thresholds_super_gte_winner
    CHECK (super_winner_threshold_views >= winner_threshold_views)
);

CREATE INDEX IF NOT EXISTS idx_model_winner_thresholds_updated_at
  ON public.model_winner_thresholds (updated_at DESC);

ALTER TABLE public.model_winner_thresholds ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  BEGIN
    REVOKE ALL ON TABLE public.model_winner_thresholds FROM anon, authenticated;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END $$;

-- Auto-detect / provenance columns on Winner Videos Hub submissions
ALTER TABLE public.winner_submissions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'va_submitted'
    CHECK (source IN ('va_submitted', 'researcher_submitted', 'auto_detected')),
  ADD COLUMN IF NOT EXISTS clariosuite_media_id text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS auto_classified_at timestamptz,
  ADD COLUMN IF NOT EXISTS threshold_at_classification jsonb,
  ADD COLUMN IF NOT EXISTS winner_threshold_at_classification integer,
  ADD COLUMN IF NOT EXISTS super_winner_threshold_at_classification integer;

-- One classification per ClarioSuite media (permanent; never re-add)
CREATE UNIQUE INDEX IF NOT EXISTS idx_winner_submissions_clariosuite_media_id
  ON public.winner_submissions (clariosuite_media_id)
  WHERE clariosuite_media_id IS NOT NULL AND clariosuite_media_id <> '';

CREATE INDEX IF NOT EXISTS idx_winner_submissions_source
  ON public.winner_submissions (source);

COMMENT ON TABLE public.model_winner_thresholds IS
  'Per-model view thresholds for Winner / Super Winner auto-detect. Changes are not retroactive.';
COMMENT ON COLUMN public.winner_submissions.source IS
  'va_submitted | researcher_submitted | auto_detected';
COMMENT ON COLUMN public.winner_submissions.clariosuite_media_id IS
  'ClarioSuite/Instagram media id used for auto-detect dedupe; set once at classification.';
COMMENT ON COLUMN public.winner_submissions.threshold_at_classification IS
  'Snapshot of {winner, super_winner} thresholds used when this post was classified (non-retroactive).';

-- Optional display fields used by Hub cards (safe if already present)
ALTER TABLE public.winner_submissions
  ADD COLUMN IF NOT EXISTS caption text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS posted_at timestamptz;
