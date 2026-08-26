-- Lightweight AI call telemetry for admin cost visibility (service-role only).
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL,
  model text,
  ok boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_logs_created_idx
  ON public.ai_usage_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS ai_usage_logs_feature_created_idx
  ON public.ai_usage_logs (feature_key, created_at DESC);

COMMENT ON TABLE public.ai_usage_logs IS
  'Approximate Anthropic call counts per feature for admin cost visibility.';

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  BEGIN
    REVOKE ALL ON TABLE public.ai_usage_logs FROM anon, authenticated;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END $$;
