-- Encrypted credentials vault (AES-256-GCM ciphertext in encrypted_data)

CREATE TABLE IF NOT EXISTS public.credential_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid REFERENCES public.modelss (id) ON DELETE SET NULL,
  category text NOT NULL,
  label text NOT NULL,
  encrypted_data text NOT NULL,
  created_by_id text,
  created_by_name text,
  updated_by_id text,
  updated_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credential_entries_model_id_idx
  ON public.credential_entries (model_id);

CREATE INDEX IF NOT EXISTS credential_entries_category_idx
  ON public.credential_entries (category);

CREATE TABLE IF NOT EXISTS public.credential_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL REFERENCES public.credential_entries (id) ON DELETE CASCADE,
  user_id text NOT NULL,
  user_name text,
  action text NOT NULL CHECK (
    action IN ('viewed_masked', 'revealed', 'copied', 'created', 'updated', 'deleted')
  ),
  field_name text,
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credential_access_log_credential_id_idx
  ON public.credential_access_log (credential_id);

CREATE INDEX IF NOT EXISTS credential_access_log_timestamp_idx
  ON public.credential_access_log (timestamp DESC);

ALTER TABLE public.credential_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credential_access_log ENABLE ROW LEVEL SECURITY;
