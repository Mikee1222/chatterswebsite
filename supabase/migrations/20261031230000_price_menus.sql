-- Price Menus: model-linked pricing (Greece / USA markets).
-- Legacy tables model_tiers, pricing_rows, pricing_specials are KEPT untouched.
-- Access: service-role only (same Phase-1 trust model as rest of app).

CREATE TABLE IF NOT EXISTS public.price_menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  market text NOT NULL CHECK (market IN ('greece', 'usa')),
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  legacy_model_tier text,
  source_menu_id uuid REFERENCES public.price_menus (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS price_menus_market_name_uidx
  ON public.price_menus (market, lower(name));
CREATE INDEX IF NOT EXISTS price_menus_market_active_idx
  ON public.price_menus (market, is_active, sort_order);

CREATE TABLE IF NOT EXISTS public.price_menu_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id uuid NOT NULL REFERENCES public.price_menus (id) ON DELETE CASCADE,
  spender_tier text NOT NULL CHECK (spender_tier IN ('high', 'medium', 'medium_low', 'low')),
  level integer NOT NULL DEFAULT 1,
  price_min numeric,
  price_max numeric,
  price_plus boolean NOT NULL DEFAULT false,
  neg_min numeric,
  neg_max numeric,
  neg_text text,
  description text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  raw_price_normal text NOT NULL DEFAULT '',
  raw_price_negotiation text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  legacy_pricing_row_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS price_menu_rows_menu_idx
  ON public.price_menu_rows (menu_id, spender_tier, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS price_menu_rows_legacy_uidx
  ON public.price_menu_rows (legacy_pricing_row_id)
  WHERE legacy_pricing_row_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.price_menu_models (
  menu_id uuid NOT NULL REFERENCES public.price_menus (id) ON DELETE CASCADE,
  model_id uuid NOT NULL REFERENCES public.modelss (id) ON DELETE CASCADE,
  linked_at timestamptz NOT NULL DEFAULT now(),
  linked_by text NOT NULL DEFAULT '',
  PRIMARY KEY (model_id),
  UNIQUE (menu_id, model_id)
);

CREATE INDEX IF NOT EXISTS price_menu_models_menu_idx
  ON public.price_menu_models (menu_id);

CREATE TABLE IF NOT EXISTS public.price_menu_specials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  price_min numeric,
  price_max numeric,
  price_plus boolean NOT NULL DEFAULT false,
  neg_min numeric,
  neg_max numeric,
  neg_text text,
  description text NOT NULL DEFAULT '',
  raw_price_normal text NOT NULL DEFAULT '',
  raw_price_negotiation text NOT NULL DEFAULT '',
  applies_to_all boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  market text NOT NULL DEFAULT 'greece' CHECK (market IN ('greece', 'usa', 'all')),
  legacy_special_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS price_menu_specials_legacy_uidx
  ON public.price_menu_specials (legacy_special_id)
  WHERE legacy_special_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.price_menu_special_models (
  special_id uuid NOT NULL REFERENCES public.price_menu_specials (id) ON DELETE CASCADE,
  model_id uuid NOT NULL REFERENCES public.modelss (id) ON DELETE CASCADE,
  PRIMARY KEY (special_id, model_id)
);

CREATE TABLE IF NOT EXISTS public.price_menu_link_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_name text NOT NULL,
  suggested_model_id uuid REFERENCES public.modelss (id) ON DELETE SET NULL,
  suggested_model_name text NOT NULL DEFAULT '',
  tier text,
  distance integer,
  score numeric,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (legacy_name, suggested_model_id)
);

CREATE TABLE IF NOT EXISTS public.price_menu_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_operation_id uuid,
  actor_id text NOT NULL DEFAULT '',
  actor_name text NOT NULL DEFAULT '',
  menu_id uuid REFERENCES public.price_menus (id) ON DELETE SET NULL,
  row_id uuid REFERENCES public.price_menu_rows (id) ON DELETE SET NULL,
  special_id uuid REFERENCES public.price_menu_specials (id) ON DELETE SET NULL,
  entity_type text NOT NULL DEFAULT 'row',
  field text NOT NULL DEFAULT '',
  before_value text,
  after_value text,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS price_menu_changes_menu_idx
  ON public.price_menu_changes (menu_id, created_at DESC);
CREATE INDEX IF NOT EXISTS price_menu_changes_bulk_idx
  ON public.price_menu_changes (bulk_operation_id)
  WHERE bulk_operation_id IS NOT NULL;

ALTER TABLE public.price_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_menu_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_menu_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_menu_specials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_menu_special_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_menu_link_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_menu_changes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  REVOKE ALL ON TABLE public.price_menus FROM anon, authenticated;
  REVOKE ALL ON TABLE public.price_menu_rows FROM anon, authenticated;
  REVOKE ALL ON TABLE public.price_menu_models FROM anon, authenticated;
  REVOKE ALL ON TABLE public.price_menu_specials FROM anon, authenticated;
  REVOKE ALL ON TABLE public.price_menu_special_models FROM anon, authenticated;
  REVOKE ALL ON TABLE public.price_menu_link_suggestions FROM anon, authenticated;
  REVOKE ALL ON TABLE public.price_menu_changes FROM anon, authenticated;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

COMMENT ON TABLE public.price_menus IS
  'Named price menus per market (greece|usa). Models link via price_menu_models.';
COMMENT ON TABLE public.price_menu_rows IS
  'Structured ladder rows for a menu × spender tier. Legacy pricing_rows kept.';
COMMENT ON TABLE public.price_menu_models IS
  'One menu per model (UNIQUE model_id).';
COMMENT ON TABLE public.price_menu_specials IS
  'Specials (sextape/customs/calls). Legacy pricing_specials kept.';
COMMENT ON TABLE public.price_menu_changes IS
  'Audit log for price menu edits and bulk operations.';
