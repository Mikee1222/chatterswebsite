-- Cached AI translations for application form text answers (original never overwritten)

ALTER TABLE public.application_form_answers
  ADD COLUMN IF NOT EXISTS translated_text text,
  ADD COLUMN IF NOT EXISTS translation_lang text,
  ADD COLUMN IF NOT EXISTS source_lang text;

COMMENT ON COLUMN public.application_form_answers.translated_text IS
  'Cached Anthropic translation of answer_text; original answer_text is never replaced.';
COMMENT ON COLUMN public.application_form_answers.translation_lang IS
  'ISO-ish target language of translated_text (en or el).';
COMMENT ON COLUMN public.application_form_answers.source_lang IS
  'Detected source language of answer_text (en, el, or other code/name).';
