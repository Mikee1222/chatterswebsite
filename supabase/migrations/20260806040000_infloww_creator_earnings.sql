-- Creator-level Infloww earnings (Supabase-only; no Airtable dual-backend)
-- Project: wagfkuxkrgsencartqtx (Gunzo)

-- ---------------------------------------------------------------------------
-- Daily creator report rollup (visitors, fans, rank, chat)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.infloww_creator_daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_infloww_id text NOT NULL,
  model_record_id text,
  model_stable_id text,
  model_name text,
  date date NOT NULL,
  performance_rank numeric,
  profile_visitors integer NOT NULL DEFAULT 0,
  guest_visitors integer NOT NULL DEFAULT 0,
  logged_in_visitors integer NOT NULL DEFAULT 0,
  active_fans integer NOT NULL DEFAULT 0,
  expired_fans integer NOT NULL DEFAULT 0,
  new_subscribers integer NOT NULL DEFAULT 0,
  renewals integer NOT NULL DEFAULT 0,
  messages_sent integer NOT NULL DEFAULT 0,
  ppvs_sent integer NOT NULL DEFAULT 0,
  fans_chatted integer NOT NULL DEFAULT 0,
  reply_time_ms numeric,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT infloww_creator_daily_stats_creator_date_key UNIQUE (creator_infloww_id, date)
);

CREATE INDEX IF NOT EXISTS infloww_creator_daily_stats_date_idx
  ON public.infloww_creator_daily_stats (date DESC);
CREATE INDEX IF NOT EXISTS infloww_creator_daily_stats_model_record_idx
  ON public.infloww_creator_daily_stats (model_record_id)
  WHERE model_record_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS infloww_creator_daily_stats_model_stable_idx
  ON public.infloww_creator_daily_stats (model_stable_id)
  WHERE model_stable_id IS NOT NULL;

COMMENT ON TABLE public.infloww_creator_daily_stats IS
  'Cached daily Infloww creator-report metrics (rank, reach, fans, chat). Join to modelss via model_record_id / model_stable_id.';
COMMENT ON COLUMN public.infloww_creator_daily_stats.creator_infloww_id IS
  'Infloww OpenAPI creator id (GET /v1/creators). Not the same as modelss.model_id (app-stable id).';
COMMENT ON COLUMN public.infloww_creator_daily_stats.model_record_id IS
  'modelss public/airtable id when matched.';
COMMENT ON COLUMN public.infloww_creator_daily_stats.model_stable_id IS
  'modelss.model_id stable text when matched.';

-- ---------------------------------------------------------------------------
-- Individual transactions (+ optional attribution from transaction-perf)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.infloww_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id text NOT NULL,
  infloww_row_id text,
  creator_infloww_id text NOT NULL,
  model_record_id text,
  model_stable_id text,
  platform_pid text,
  fan_id text,
  fan_name text,
  created_time timestamptz,
  type text,
  tip_source text,
  status text,
  amount numeric NOT NULL DEFAULT 0,
  fee numeric NOT NULL DEFAULT 0,
  net numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  -- From GET /v1/transaction-perf/details
  sales_rule text,
  attribute_employee_id text,
  sales_amount numeric,
  last_loading_sync_at timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT infloww_transactions_transaction_id_key UNIQUE (transaction_id)
);

CREATE INDEX IF NOT EXISTS infloww_transactions_creator_created_idx
  ON public.infloww_transactions (creator_infloww_id, created_time DESC);
CREATE INDEX IF NOT EXISTS infloww_transactions_status_idx
  ON public.infloww_transactions (status)
  WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS infloww_transactions_model_record_idx
  ON public.infloww_transactions (model_record_id)
  WHERE model_record_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS infloww_transactions_attr_employee_idx
  ON public.infloww_transactions (attribute_employee_id, created_time DESC)
  WHERE attribute_employee_id IS NOT NULL;

COMMENT ON TABLE public.infloww_transactions IS
  'Infloww creator transactions. Rows with status=loading are re-synced until done (~12h cadence).';

-- ---------------------------------------------------------------------------
-- Marketing links (campaign / trial / tracking)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.infloww_marketing_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id text NOT NULL,
  creator_infloww_id text NOT NULL,
  infloww_link_id text NOT NULL,
  link_type text NOT NULL,
  message text,
  campaign_type text,
  sub_count integer NOT NULL DEFAULT 0,
  sub_limit integer,
  sub_duration integer,
  discount numeric,
  finished_flag boolean NOT NULL DEFAULT false,
  earnings_gross numeric NOT NULL DEFAULT 0,
  earnings_net numeric NOT NULL DEFAULT 0,
  paying_fans_count integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  link_created_time timestamptz,
  expired_time timestamptz,
  link_updated_time timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT infloww_marketing_links_model_link_key UNIQUE (model_id, infloww_link_id)
);

CREATE INDEX IF NOT EXISTS infloww_marketing_links_creator_idx
  ON public.infloww_marketing_links (creator_infloww_id);
CREATE INDEX IF NOT EXISTS infloww_marketing_links_type_idx
  ON public.infloww_marketing_links (link_type);

COMMENT ON TABLE public.infloww_marketing_links IS
  'Infloww campaign/trial/tracking links. model_id = modelss public/airtable id.';
COMMENT ON COLUMN public.infloww_marketing_links.model_id IS
  'modelss public id (airtable_id). Unique with infloww_link_id.';

-- ---------------------------------------------------------------------------
-- Fans acquired via a marketing link
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.infloww_link_fans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id text NOT NULL,
  marketing_link_uuid uuid REFERENCES public.infloww_marketing_links(id) ON DELETE CASCADE,
  creator_infloww_id text,
  model_id text,
  fan_id text NOT NULL,
  fan_name text,
  subscription_earning_gross numeric NOT NULL DEFAULT 0,
  subscription_earning_net numeric NOT NULL DEFAULT 0,
  posts_earning_gross numeric NOT NULL DEFAULT 0,
  posts_earning_net numeric NOT NULL DEFAULT 0,
  messages_earning_gross numeric NOT NULL DEFAULT 0,
  messages_earning_net numeric NOT NULL DEFAULT 0,
  streams_earning_gross numeric NOT NULL DEFAULT 0,
  streams_earning_net numeric NOT NULL DEFAULT 0,
  tips_earning_gross numeric NOT NULL DEFAULT 0,
  tips_earning_net numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  subscribed_time timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT infloww_link_fans_link_fan_key UNIQUE (link_id, fan_id)
);

CREATE INDEX IF NOT EXISTS infloww_link_fans_model_idx
  ON public.infloww_link_fans (model_id)
  WHERE model_id IS NOT NULL;

COMMENT ON TABLE public.infloww_link_fans IS
  'Fans from GET /v1/linkfans. link_id = Infloww marketing link id.';

-- RLS: service-role only (same pattern as infloww_daily_stats)
ALTER TABLE public.infloww_creator_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.infloww_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.infloww_marketing_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.infloww_link_fans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'REVOKE ALL ON TABLE public.infloww_creator_daily_stats FROM anon, authenticated';
  EXECUTE 'REVOKE ALL ON TABLE public.infloww_transactions FROM anon, authenticated';
  EXECUTE 'REVOKE ALL ON TABLE public.infloww_marketing_links FROM anon, authenticated';
  EXECUTE 'REVOKE ALL ON TABLE public.infloww_link_fans FROM anon, authenticated';
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;
