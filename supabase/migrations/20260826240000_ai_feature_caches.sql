-- Cached Anthropic outputs for AI features (daily briefing, monthly reports, patterns, digests).
CREATE TABLE IF NOT EXISTS public.ai_feature_caches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL,
  cache_key text NOT NULL,
  content_text text NOT NULL,
  context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (feature_key, cache_key)
);

CREATE INDEX IF NOT EXISTS ai_feature_caches_feature_generated_idx
  ON public.ai_feature_caches (feature_key, generated_at DESC);

COMMENT ON TABLE public.ai_feature_caches IS
  'Cached Claude outputs for app AI features (briefings, reports, patterns). Grounded in real app data snapshots.';

ALTER TABLE public.ai_feature_caches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  BEGIN
    REVOKE ALL ON TABLE public.ai_feature_caches FROM anon, authenticated;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END $$;
