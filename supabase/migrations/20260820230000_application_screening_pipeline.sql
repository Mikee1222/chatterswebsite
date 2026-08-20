-- Screening + pipeline builder for application forms
-- Adds pipeline_config, candidate sessions, cognitive & EQ results.

ALTER TABLE public.application_forms
  ADD COLUMN IF NOT EXISTS pipeline_config jsonb NOT NULL DEFAULT '[
    {"step":"cognitive_screening","enabled":false,"order":0},
    {"step":"eq_screening","enabled":false,"order":1},
    {"step":"application_form","enabled":true,"order":2}
  ]'::jsonb;

CREATE TABLE IF NOT EXISTS public.application_candidate_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.application_forms (id) ON DELETE CASCADE,
  response_id uuid REFERENCES public.application_form_responses (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  respondent_ip text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_candidate_sessions_form_id_idx
  ON public.application_candidate_sessions (form_id);

CREATE INDEX IF NOT EXISTS application_candidate_sessions_response_id_idx
  ON public.application_candidate_sessions (response_id);

CREATE TABLE IF NOT EXISTS public.application_cognitive_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.application_candidate_sessions (id) ON DELETE CASCADE,
  response_id uuid REFERENCES public.application_form_responses (id) ON DELETE SET NULL,
  raw_score integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  category_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  time_taken_seconds integer NOT NULL DEFAULT 0,
  percentile_at_time_of_completion numeric(5,2),
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT application_cognitive_results_session_unique UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS application_cognitive_results_response_id_idx
  ON public.application_cognitive_results (response_id);

CREATE INDEX IF NOT EXISTS application_cognitive_results_form_session_idx
  ON public.application_cognitive_results (session_id);

CREATE TABLE IF NOT EXISTS public.application_eq_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.application_candidate_sessions (id) ON DELETE CASCADE,
  response_id uuid REFERENCES public.application_form_responses (id) ON DELETE SET NULL,
  overall_score numeric(5,2) NOT NULL DEFAULT 0,
  dimension_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  time_taken_seconds integer NOT NULL DEFAULT 0,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT application_eq_results_session_unique UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS application_eq_results_response_id_idx
  ON public.application_eq_results (response_id);

ALTER TABLE public.application_candidate_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_cognitive_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_eq_results ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  BEGIN
    REVOKE ALL ON TABLE public.application_candidate_sessions FROM anon, authenticated;
    REVOKE ALL ON TABLE public.application_cognitive_results FROM anon, authenticated;
    REVOKE ALL ON TABLE public.application_eq_results FROM anon, authenticated;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END $$;
