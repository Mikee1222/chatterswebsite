-- Speed up Applications responses list language filter + date sort.
CREATE INDEX IF NOT EXISTS application_form_responses_form_lang_submitted_idx
  ON public.application_form_responses (form_id, preferred_language, submitted_at DESC);
