-- Record Legal Agreement consent on candidate sessions (linked to response via response_id).

ALTER TABLE public.application_candidate_sessions
  ADD COLUMN IF NOT EXISTS agreed_at timestamptz,
  ADD COLUMN IF NOT EXISTS agreement_version text;

CREATE INDEX IF NOT EXISTS application_candidate_sessions_agreed_at_idx
  ON public.application_candidate_sessions (agreed_at)
  WHERE agreed_at IS NOT NULL;
