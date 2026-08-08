-- ClarioSuite Instagram Insights (Supabase-only)
-- Project: wagfkuxkrgsencartqtx (Gunzo)

-- ---------------------------------------------------------------------------
-- Link modelss → ClarioSuite IG user id
-- ---------------------------------------------------------------------------
ALTER TABLE public.modelss
  ADD COLUMN IF NOT EXISTS clariosuite_ig_user_id text;

COMMENT ON COLUMN public.modelss.clariosuite_ig_user_id IS
  'ClarioSuite Instagram user id (GET /api/v1/accounts igUserId). Used for Instagram Insights sync.';

CREATE UNIQUE INDEX IF NOT EXISTS modelss_clariosuite_ig_user_id_uidx
  ON public.modelss (clariosuite_ig_user_id)
  WHERE clariosuite_ig_user_id IS NOT NULL AND trim(clariosuite_ig_user_id) <> '';

-- ---------------------------------------------------------------------------
-- Daily account insights (reach / views / interactions / followers)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clariosuite_daily_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_user_id text NOT NULL,
  model_record_id text,
  model_stable_id text,
  model_name text,
  date date NOT NULL,
  reach integer NOT NULL DEFAULT 0,
  views integer NOT NULL DEFAULT 0,
  total_interactions integer NOT NULL DEFAULT 0,
  follower_count integer,
  engagement_rate numeric,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clariosuite_daily_insights_ig_date_key UNIQUE (ig_user_id, date)
);

CREATE INDEX IF NOT EXISTS clariosuite_daily_insights_date_idx
  ON public.clariosuite_daily_insights (date DESC);
CREATE INDEX IF NOT EXISTS clariosuite_daily_insights_model_record_idx
  ON public.clariosuite_daily_insights (model_record_id)
  WHERE model_record_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS clariosuite_daily_insights_model_stable_idx
  ON public.clariosuite_daily_insights (model_stable_id)
  WHERE model_stable_id IS NOT NULL;

COMMENT ON TABLE public.clariosuite_daily_insights IS
  'Cached daily ClarioSuite account insights (reach, views, interactions, followers).';

-- ---------------------------------------------------------------------------
-- Audience demographics snapshot (latest per IG account)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clariosuite_audience_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_user_id text NOT NULL,
  model_record_id text,
  model_stable_id text,
  model_name text,
  followers_count integer,
  age_ranges jsonb NOT NULL DEFAULT '[]'::jsonb,
  countries jsonb NOT NULL DEFAULT '[]'::jsonb,
  gender_split jsonb NOT NULL DEFAULT '[]'::jsonb,
  cities jsonb NOT NULL DEFAULT '[]'::jsonb,
  locales jsonb NOT NULL DEFAULT '[]'::jsonb,
  online_followers_by_hour jsonb NOT NULL DEFAULT '[]'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clariosuite_audience_snapshots_ig_key UNIQUE (ig_user_id)
);

CREATE INDEX IF NOT EXISTS clariosuite_audience_snapshots_model_record_idx
  ON public.clariosuite_audience_snapshots (model_record_id)
  WHERE model_record_id IS NOT NULL;

COMMENT ON TABLE public.clariosuite_audience_snapshots IS
  'Latest ClarioSuite audience demographics + onlineFollowers (best-time-to-post). One row per IG account.';

-- ---------------------------------------------------------------------------
-- Top posts by engagement score (top N per model per sync)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clariosuite_top_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_user_id text NOT NULL,
  model_record_id text,
  model_stable_id text,
  model_name text,
  media_id text NOT NULL,
  permalink text,
  media_type text,
  media_product_type text,
  caption text,
  image_url text,
  engagement_score numeric,
  reach integer NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  comments integer NOT NULL DEFAULT 0,
  shares integer NOT NULL DEFAULT 0,
  saved integer NOT NULL DEFAULT 0,
  views integer NOT NULL DEFAULT 0,
  posted_at timestamptz,
  rank integer NOT NULL DEFAULT 1,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clariosuite_top_posts_ig_media_key UNIQUE (ig_user_id, media_id)
);

CREATE INDEX IF NOT EXISTS clariosuite_top_posts_ig_rank_idx
  ON public.clariosuite_top_posts (ig_user_id, rank ASC);
CREATE INDEX IF NOT EXISTS clariosuite_top_posts_model_record_idx
  ON public.clariosuite_top_posts (model_record_id)
  WHERE model_record_id IS NOT NULL;

COMMENT ON TABLE public.clariosuite_top_posts IS
  'Top Instagram posts by engagement score from ClarioSuite media insights.';

-- Phase 1 RLS: service-role only (matches existing infloww tables).
ALTER TABLE public.clariosuite_daily_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clariosuite_audience_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clariosuite_top_posts ENABLE ROW LEVEL SECURITY;
