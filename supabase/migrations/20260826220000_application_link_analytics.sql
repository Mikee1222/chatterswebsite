-- Privacy-respecting funnel analytics for public application form links.
-- Aggregate events only (session UUID, no extra PII beyond device/referrer).

CREATE TABLE IF NOT EXISTS public.application_link_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.application_forms (id) ON DELETE CASCADE,
  session_id text NOT NULL,
  event_type text NOT NULL
    CHECK (event_type IN (
      'page_view',
      'started',
      'step_complete',
      'submitted',
      'abandoned'
    )),
  step_name text,
  device_type text NOT NULL DEFAULT 'unknown'
    CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'unknown')),
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_link_analytics_form_created_idx
  ON public.application_link_analytics (form_id, created_at DESC);

CREATE INDEX IF NOT EXISTS application_link_analytics_form_event_idx
  ON public.application_link_analytics (form_id, event_type);

CREATE INDEX IF NOT EXISTS application_link_analytics_session_idx
  ON public.application_link_analytics (form_id, session_id, event_type);

COMMENT ON TABLE public.application_link_analytics IS
  'Anonymous funnel events for /apply/[slug] (views, steps, submit, abandon). No invasive PII.';

-- Cached Anthropic natural-language insight for a form's funnel snapshot.
CREATE TABLE IF NOT EXISTS public.application_form_analytics_insights (
  form_id uuid PRIMARY KEY REFERENCES public.application_forms (id) ON DELETE CASCADE,
  insight_text text NOT NULL,
  funnel_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.application_form_analytics_insights IS
  'Cached Claude insight summarizing real application-link funnel numbers; refresh on demand or daily.';

ALTER TABLE public.application_link_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_form_analytics_insights ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  BEGIN
    REVOKE ALL ON TABLE public.application_link_analytics FROM anon, authenticated;
    REVOKE ALL ON TABLE public.application_form_analytics_insights FROM anon, authenticated;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END $$;
