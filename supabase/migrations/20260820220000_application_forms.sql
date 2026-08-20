-- Custom Form Builder for recruitment / applications
-- Service-role access only (RLS enabled, no anon/authenticated policies).

CREATE TABLE IF NOT EXISTS public.application_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  slug text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'closed')),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT application_forms_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS application_forms_status_idx
  ON public.application_forms (status);

CREATE INDEX IF NOT EXISTS application_forms_created_at_idx
  ON public.application_forms (created_at DESC);

CREATE TABLE IF NOT EXISTS public.application_form_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.application_forms (id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL
    CHECK (question_type IN (
      'short_text',
      'long_text',
      'multiple_choice',
      'checkboxes',
      'dropdown',
      'rating',
      'yes_no'
    )),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_required boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_form_questions_form_id_idx
  ON public.application_form_questions (form_id, display_order);

CREATE TABLE IF NOT EXISTS public.application_form_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.application_forms (id) ON DELETE CASCADE,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  respondent_ip text,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewed', 'shortlisted', 'rejected', 'hired')),
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_form_responses_form_id_idx
  ON public.application_form_responses (form_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS application_form_responses_status_idx
  ON public.application_form_responses (form_id, status);

CREATE TABLE IF NOT EXISTS public.application_form_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES public.application_form_responses (id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.application_form_questions (id) ON DELETE CASCADE,
  answer_text text,
  answer_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT application_form_answers_response_question_unique
    UNIQUE (response_id, question_id)
);

CREATE INDEX IF NOT EXISTS application_form_answers_response_id_idx
  ON public.application_form_answers (response_id);

CREATE INDEX IF NOT EXISTS application_form_answers_question_id_idx
  ON public.application_form_answers (question_id);

ALTER TABLE public.application_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_form_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_form_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_form_answers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  BEGIN
    REVOKE ALL ON TABLE public.application_forms FROM anon, authenticated;
    REVOKE ALL ON TABLE public.application_form_questions FROM anon, authenticated;
    REVOKE ALL ON TABLE public.application_form_responses FROM anon, authenticated;
    REVOKE ALL ON TABLE public.application_form_answers FROM anon, authenticated;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END $$;
