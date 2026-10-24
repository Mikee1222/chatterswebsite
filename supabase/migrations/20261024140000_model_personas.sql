-- Model Personas: structured per-model profile (service-role-only RLS).
-- Sensitive sections (physique, intimate_details) gated in app via personas:view_sensitive.

CREATE TABLE IF NOT EXISTS public.model_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id text NOT NULL UNIQUE,
  bio text NOT NULL DEFAULT '',
  personal_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  chatting jsonb NOT NULL DEFAULT '{}'::jsonb,
  lifestyle jsonb NOT NULL DEFAULT '{}'::jsonb,
  physique jsonb NOT NULL DEFAULT '{}'::jsonb,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  intimate_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  socials jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Explicit opt-in for sending religion/ideology/relationship/orientation to AI (default off).
  ai_context_flags jsonb NOT NULL DEFAULT '{
    "religion": false,
    "ideology": false,
    "relationship": false,
    "orientation": false
  }'::jsonb,
  draft jsonb,
  last_updated_by text NOT NULL DEFAULT '',
  last_updated_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS model_personas_model_id_idx
  ON public.model_personas (model_id);
CREATE INDEX IF NOT EXISTS model_personas_updated_at_idx
  ON public.model_personas (updated_at DESC);

CREATE TABLE IF NOT EXISTS public.model_persona_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES public.model_personas (id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  saved_by text NOT NULL DEFAULT '',
  saved_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS model_persona_revisions_persona_id_idx
  ON public.model_persona_revisions (persona_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.model_persona_live_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES public.model_personas (id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  is_live boolean NOT NULL DEFAULT true,
  show_when_inactive boolean NOT NULL DEFAULT false,
  created_by text NOT NULL DEFAULT '',
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS model_persona_live_updates_persona_id_idx
  ON public.model_persona_live_updates (persona_id, starts_at DESC);
CREATE INDEX IF NOT EXISTS model_persona_live_updates_ends_at_idx
  ON public.model_persona_live_updates (ends_at)
  WHERE is_live = true;

-- Admin-editable persona type / chatting strategy option lists
CREATE TABLE IF NOT EXISTS public.persona_option_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_key text NOT NULL UNIQUE,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.persona_option_lists (list_key, options)
VALUES
  (
    'persona_types',
    '[
      "Girl Next Door",
      "Flirty & Playful",
      "Confident",
      "Shy & Sweet",
      "Dominant",
      "Girlfriend Experience"
    ]'::jsonb
  ),
  (
    'chatting_strategies',
    '["Relationship builder", "Sales driver", "Balanced"]'::jsonb
  )
ON CONFLICT (list_key) DO NOTHING;

ALTER TABLE public.model_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_persona_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_persona_live_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_option_lists ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  REVOKE ALL ON TABLE public.model_personas FROM anon, authenticated;
  REVOKE ALL ON TABLE public.model_persona_revisions FROM anon, authenticated;
  REVOKE ALL ON TABLE public.model_persona_live_updates FROM anon, authenticated;
  REVOKE ALL ON TABLE public.persona_option_lists FROM anon, authenticated;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

COMMENT ON TABLE public.model_personas IS
  'Structured persona profile per modelss row. Service-role-only. Sensitive sections stripped in app without personas:view_sensitive.';
COMMENT ON TABLE public.model_persona_revisions IS
  'JSON snapshots of persona on each explicit Save.';
COMMENT ON TABLE public.model_persona_live_updates IS
  'Short-lived live context entries (max 7 active enforced in app). Auto-expire at ends_at.';
COMMENT ON TABLE public.persona_option_lists IS
  'Admin-editable option lists for persona type and chatting strategy.';

-- Opt-in grants (Roles UI remains authoritative; these seed suggested defaults).
UPDATE public.roles
SET
  permissions = (COALESCE(permissions::jsonb, '[]'::jsonb)
    || '"personas:view"'::jsonb
    || '"personas:view_sensitive"'::jsonb
    || '"personas:manage"'::jsonb
    || '"personas:edit_own"'::jsonb
    || '"creative_studio:use"'::jsonb)::text,
  updated_at = now()
WHERE role_id = 'admin';

UPDATE public.roles
SET
  permissions = (COALESCE(permissions::jsonb, '[]'::jsonb)
    || '"personas:view"'::jsonb
    || '"personas:manage"'::jsonb)::text,
  updated_at = now()
WHERE role_id = 'manager'
  AND NOT (COALESCE(permissions::jsonb, '[]'::jsonb) ? 'personas:view');

UPDATE public.roles
SET
  permissions = (COALESCE(permissions::jsonb, '[]'::jsonb)
    || '"personas:view"'::jsonb
    || '"creative_studio:use"'::jsonb)::text,
  updated_at = now()
WHERE role_id = 'creative'
  AND NOT (COALESCE(permissions::jsonb, '[]'::jsonb) ? 'personas:view');
