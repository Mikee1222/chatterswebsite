-- Model Wardrobe: outfits / locations / props per creator, with photo + last-used tracking.
-- Used by Draft briefs to pick ONE outfit + ONE location per recording brief (bunch) with rotation.

CREATE TABLE IF NOT EXISTS public.model_wardrobe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('outfit', 'location', 'prop')),
  number integer NOT NULL DEFAULT 0,
  name text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  color text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  -- sb:// token in the attachments bucket (wardrobe/<model_id>/photos/...)
  photo_url text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  last_used_brief_id uuid,
  use_count integer NOT NULL DEFAULT 0,
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS model_wardrobe_items_model_kind_idx
  ON public.model_wardrobe_items (model_id, kind, number);

CREATE TABLE IF NOT EXISTS public.model_wardrobe_settings (
  model_id text PRIMARY KEY,
  rules text NOT NULL DEFAULT '',
  updated_by text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Recording briefs remember which wardrobe items they used (rotation + photos in the brief).
ALTER TABLE public.recording_briefs
  ADD COLUMN IF NOT EXISTS outfit_item_id uuid,
  ADD COLUMN IF NOT EXISTS location_item_id uuid;

ALTER TABLE public.model_wardrobe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_wardrobe_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  REVOKE ALL ON TABLE public.model_wardrobe_items FROM anon, authenticated;
  REVOKE ALL ON TABLE public.model_wardrobe_settings FROM anon, authenticated;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

COMMENT ON TABLE public.model_wardrobe_items IS
  'Per-creator wardrobe (outfits, locations, props) with photo + last-used tracking (service-role only).';
