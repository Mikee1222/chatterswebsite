-- Hermes AI agent tokens (Bearer gz_agent_…)
-- Do NOT apply from this PR without ops approval; migration is shipped for review only.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_agent boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.is_agent IS
  'True for headless AI agent users (e.g. Hermes). No password/cookie login; Bearer agent tokens only.';

CREATE TABLE IF NOT EXISTS public.agent_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  label text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  revoked_at timestamptz,
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS agent_tokens_user_id_idx
  ON public.agent_tokens (user_id);

CREATE INDEX IF NOT EXISTS agent_tokens_active_lookup_idx
  ON public.agent_tokens (token_hash)
  WHERE revoked_at IS NULL;

ALTER TABLE public.agent_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  BEGIN
    REVOKE ALL ON TABLE public.agent_tokens FROM anon, authenticated;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END $$;

COMMENT ON TABLE public.agent_tokens IS
  'Hashed Bearer tokens (gz_agent_…) for Hermes/agent VA users. Service-role only; plaintext shown once at creation.';
