-- GetMySocial link-in-bio analytics (Supabase)
-- Project: wagfkuxkrgsencartqtx (Gunzo)

-- ---------------------------------------------------------------------------
-- getmysocial_links — model ↔ GetMySocial link (lnk_*) with Link A/B role
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.getmysocial_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id text NOT NULL,
  getmysocial_link_id text NOT NULL,
  link_role text NOT NULL DEFAULT 'A'
    CHECK (link_role IN ('A', 'B')),
  link_label text NOT NULL DEFAULT 'Link',
  shortcode text,
  of_destination_hint text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT getmysocial_links_link_uidx UNIQUE (getmysocial_link_id),
  CONSTRAINT getmysocial_links_model_link_key UNIQUE (model_id, getmysocial_link_id),
  CONSTRAINT getmysocial_links_model_role_key UNIQUE (model_id, link_role)
);

CREATE INDEX IF NOT EXISTS getmysocial_links_model_id_idx
  ON public.getmysocial_links (model_id);

COMMENT ON TABLE public.getmysocial_links IS
  'GetMySocial landing/direct links linked to a model. link_role A/B mirrors story Link A/B rotation.';

ALTER TABLE public.getmysocial_links ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- getmysocial_daily_analytics — daily pageviews / button clicks / UV snapshot
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.getmysocial_daily_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id text NOT NULL,
  getmysocial_link_id text NOT NULL,
  getmysocial_link_row_id uuid
    REFERENCES public.getmysocial_links(id) ON DELETE SET NULL,
  link_role text,
  model_name text,
  shortcode text,
  link_label text,
  date date NOT NULL,
  pageviews integer NOT NULL DEFAULT 0,
  button_clicks integer NOT NULL DEFAULT 0,
  unique_visitors integer NOT NULL DEFAULT 0,
  ctr_pct numeric,
  shield_blocked_pct numeric,
  shield_blocked_count integer NOT NULL DEFAULT 0,
  timeframe text,
  overview_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT getmysocial_daily_analytics_link_date_key UNIQUE (getmysocial_link_id, date)
);

CREATE INDEX IF NOT EXISTS getmysocial_daily_analytics_date_idx
  ON public.getmysocial_daily_analytics (date DESC);
CREATE INDEX IF NOT EXISTS getmysocial_daily_analytics_model_idx
  ON public.getmysocial_daily_analytics (model_id);

COMMENT ON TABLE public.getmysocial_daily_analytics IS
  'Cached daily GetMySocial pageviews/button clicks per linked link.';

ALTER TABLE public.getmysocial_daily_analytics ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- getmysocial_referrers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.getmysocial_referrers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id text NOT NULL,
  getmysocial_link_id text NOT NULL,
  getmysocial_link_row_id uuid
    REFERENCES public.getmysocial_links(id) ON DELETE SET NULL,
  link_role text,
  timeframe text NOT NULL DEFAULT 'thisMonth',
  referrer text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT getmysocial_referrers_uniq
    UNIQUE (getmysocial_link_id, timeframe, referrer)
);

CREATE INDEX IF NOT EXISTS getmysocial_referrers_model_idx
  ON public.getmysocial_referrers (model_id);

ALTER TABLE public.getmysocial_referrers ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- getmysocial_breakdowns — countries / devices / browsers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.getmysocial_breakdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id text NOT NULL,
  getmysocial_link_id text NOT NULL,
  getmysocial_link_row_id uuid
    REFERENCES public.getmysocial_links(id) ON DELETE SET NULL,
  link_role text,
  dimension text NOT NULL,
  timeframe text NOT NULL DEFAULT 'thisMonth',
  label text NOT NULL,
  label_code text,
  count integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT getmysocial_breakdowns_uniq
    UNIQUE (getmysocial_link_id, dimension, timeframe, label)
);

CREATE INDEX IF NOT EXISTS getmysocial_breakdowns_model_dim_idx
  ON public.getmysocial_breakdowns (model_id, dimension);

ALTER TABLE public.getmysocial_breakdowns ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- getmysocial_visitor_events — recent visit log (90-day retention)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.getmysocial_visitor_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id text NOT NULL,
  getmysocial_link_id text NOT NULL,
  getmysocial_link_row_id uuid
    REFERENCES public.getmysocial_links(id) ON DELETE SET NULL,
  link_role text,
  event_timestamp timestamptz NOT NULL,
  country text,
  country_code text,
  region text,
  city text,
  device text,
  browser text,
  os text,
  referrer text,
  is_bot boolean NOT NULL DEFAULT false,
  is_proxy boolean NOT NULL DEFAULT false,
  is_hosting boolean NOT NULL DEFAULT false,
  safe_page_triggered boolean NOT NULL DEFAULT false,
  link_shortcode text,
  link_display_name text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS getmysocial_visitor_events_ts_idx
  ON public.getmysocial_visitor_events (event_timestamp DESC);
CREATE INDEX IF NOT EXISTS getmysocial_visitor_events_model_idx
  ON public.getmysocial_visitor_events (model_id, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS getmysocial_visitor_events_link_idx
  ON public.getmysocial_visitor_events (getmysocial_link_id, event_timestamp DESC);

COMMENT ON TABLE public.getmysocial_visitor_events IS
  'Cached GetMySocial visitor events. Retain ~90 days; cron deletes older rows.';

ALTER TABLE public.getmysocial_visitor_events ENABLE ROW LEVEL SECURITY;
