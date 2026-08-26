-- AI mini-summary + rule-based auto flags for application responses

ALTER TABLE public.application_form_responses
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS auto_flags jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.application_form_responses.ai_summary IS
  'Cached Claude summary of candidate answers + screening scores; generated once on submit or first admin view.';
COMMENT ON COLUMN public.application_form_responses.auto_flags IS
  'Rule-based flag objects [{id,label,severity}] cached for list filters and badges.';
