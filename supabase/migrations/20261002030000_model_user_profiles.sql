-- Many-to-many: one model USER (login) ↔ many model PROFILES (modelss).
-- Each profile keeps its own Infloww / ClarioSuite / earnings / content.
-- users.linked_model remains a denormalized mirror for legacy readers.

CREATE TABLE IF NOT EXISTS public.model_user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  model_id uuid NOT NULL REFERENCES public.modelss(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_user_profiles_user_model_key UNIQUE (user_id, model_id)
);

-- One login account per profile (a user may own many profiles).
CREATE UNIQUE INDEX IF NOT EXISTS model_user_profiles_model_id_uidx
  ON public.model_user_profiles (model_id);

-- At most one primary profile per user.
CREATE UNIQUE INDEX IF NOT EXISTS model_user_profiles_one_primary_uidx
  ON public.model_user_profiles (user_id)
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS model_user_profiles_user_id_idx
  ON public.model_user_profiles (user_id);

COMMENT ON TABLE public.model_user_profiles IS
  'Links model login users to one or more modelss profiles. Exactly one is_primary per user when links exist.';

-- Backfill from existing 1:1 users.linked_model (zero data loss).
INSERT INTO public.model_user_profiles (user_id, model_id, is_primary)
SELECT
  u.id,
  mid.model_uuid,
  (mid.ord = 1) AS is_primary
FROM public.users u
CROSS JOIN LATERAL unnest(COALESCE(u.linked_model, ARRAY[]::uuid[]))
  WITH ORDINALITY AS mid(model_uuid, ord)
WHERE u.role = 'model'
  AND mid.model_uuid IS NOT NULL
ON CONFLICT (user_id, model_id) DO NOTHING;

ALTER TABLE public.model_user_profiles ENABLE ROW LEVEL SECURITY;
