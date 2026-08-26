-- Hire credentials on application responses (cosmetic username + encrypted password)

ALTER TABLE public.application_form_responses
  ADD COLUMN IF NOT EXISTS generated_username text,
  ADD COLUMN IF NOT EXISTS encrypted_hire_password text,
  ADD COLUMN IF NOT EXISTS hire_credentials_created_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS application_form_responses_generated_username_uidx
  ON public.application_form_responses (generated_username)
  WHERE generated_username IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.application_hire_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES public.application_form_responses (id) ON DELETE CASCADE,
  user_id text NOT NULL,
  user_name text,
  action text NOT NULL CHECK (action IN ('revealed', 'copied', 'viewed_masked')),
  field_name text,
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_hire_access_log_response_id_idx
  ON public.application_hire_access_log (response_id);

CREATE INDEX IF NOT EXISTS application_hire_access_log_timestamp_idx
  ON public.application_hire_access_log (timestamp DESC);

ALTER TABLE public.application_hire_access_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  BEGIN
    REVOKE ALL ON TABLE public.application_hire_access_log FROM anon, authenticated;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END $$;

COMMENT ON COLUMN public.application_form_responses.generated_username IS
  'Cosmetic hire username email (firstname+suffixgunzo@gmail.com); not a real mailbox.';
COMMENT ON COLUMN public.application_form_responses.encrypted_hire_password IS
  'AES-256-GCM ciphertext (CREDENTIALS_ENCRYPTION_KEY) for hire password payload.';
