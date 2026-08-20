-- Typing speed test results + bilingual form/pipeline support

-- Date question type
ALTER TABLE public.application_form_questions
  DROP CONSTRAINT IF EXISTS application_form_questions_question_type_check;

ALTER TABLE public.application_form_questions
  ADD CONSTRAINT application_form_questions_question_type_check
  CHECK (question_type IN (
    'short_text',
    'long_text',
    'multiple_choice',
    'checkboxes',
    'dropdown',
    'rating',
    'yes_no',
    'date'
  ));

-- Bilingual form chrome
ALTER TABLE public.application_forms
  ADD COLUMN IF NOT EXISTS description_el text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS footer_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS footer_text_el text NOT NULL DEFAULT '';

ALTER TABLE public.application_form_questions
  ADD COLUMN IF NOT EXISTS question_text_el text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS options_el jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Preferred language on session + response
ALTER TABLE public.application_candidate_sessions
  ADD COLUMN IF NOT EXISTS preferred_language text
    CHECK (preferred_language IS NULL OR preferred_language IN ('en', 'el'));

ALTER TABLE public.application_form_responses
  ADD COLUMN IF NOT EXISTS preferred_language text
    CHECK (preferred_language IS NULL OR preferred_language IN ('en', 'el'));

-- Update default pipeline to include typing step (new forms only via app DEFAULT)
ALTER TABLE public.application_forms
  ALTER COLUMN pipeline_config SET DEFAULT '[
    {"step":"cognitive_screening","enabled":false,"order":0},
    {"step":"eq_screening","enabled":false,"order":1},
    {"step":"typing_speed_test","enabled":false,"order":2},
    {"step":"application_form","enabled":true,"order":3}
  ]'::jsonb;

CREATE TABLE IF NOT EXISTS public.application_typing_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.application_candidate_sessions (id) ON DELETE CASCADE,
  response_id uuid REFERENCES public.application_form_responses (id) ON DELETE SET NULL,
  wpm numeric(6,2) NOT NULL DEFAULT 0,
  accuracy_percent numeric(5,2) NOT NULL DEFAULT 0,
  passage_language text NOT NULL DEFAULT 'en'
    CHECK (passage_language IN ('en', 'el')),
  device_type text NOT NULL DEFAULT 'desktop'
    CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'unknown')),
  passage_id text,
  time_taken_seconds integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT application_typing_results_session_unique UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS application_typing_results_response_id_idx
  ON public.application_typing_results (response_id);

CREATE INDEX IF NOT EXISTS application_typing_results_wpm_idx
  ON public.application_typing_results (wpm DESC);

ALTER TABLE public.application_typing_results ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  BEGIN
    REVOKE ALL ON TABLE public.application_typing_results FROM anon, authenticated;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END $$;
