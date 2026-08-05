-- Infloww employee performance sync: link users + daily stats cache

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS infloww_employee_id bigint;

COMMENT ON COLUMN public.users.infloww_employee_id IS
  'Infloww employee ID used to sync sales/chat performance via OpenAPI employee-report endpoints';

CREATE TABLE IF NOT EXISTS public.infloww_daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  infloww_employee_id bigint NOT NULL,
  infloww_performer_id bigint NOT NULL DEFAULT 0,
  date date NOT NULL,
  performer_name text,
  -- Sales metrics (currency units as returned by Infloww)
  sales numeric NOT NULL DEFAULT 0,
  ppv_sales numeric NOT NULL DEFAULT 0,
  tips numeric NOT NULL DEFAULT 0,
  dm_sales numeric NOT NULL DEFAULT 0,
  pmm_sales numeric NOT NULL DEFAULT 0,
  ofmm_sales numeric NOT NULL DEFAULT 0,
  -- Chat / activity metrics
  messages_sent integer NOT NULL DEFAULT 0,
  ppvs_sent integer NOT NULL DEFAULT 0,
  fans_chatted integer NOT NULL DEFAULT 0,
  fans_who_spent integer NOT NULL DEFAULT 0,
  golden_ratio numeric,
  fan_cvr numeric,
  avg_earnings_per_spending_fan numeric,
  response_time_seconds numeric,
  sales_per_hour numeric,
  messages_per_hour numeric,
  fans_chatted_per_hour numeric,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT infloww_daily_stats_user_performer_date_key UNIQUE (user_id, infloww_performer_id, date)
);

CREATE INDEX IF NOT EXISTS infloww_daily_stats_user_date_idx
  ON public.infloww_daily_stats (user_id, date DESC);

CREATE INDEX IF NOT EXISTS infloww_daily_stats_date_idx
  ON public.infloww_daily_stats (date DESC);

CREATE INDEX IF NOT EXISTS infloww_daily_stats_employee_idx
  ON public.infloww_daily_stats (infloww_employee_id);

CREATE INDEX IF NOT EXISTS users_infloww_employee_id_idx
  ON public.users (infloww_employee_id)
  WHERE infloww_employee_id IS NOT NULL;

ALTER TABLE public.infloww_daily_stats ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'REVOKE ALL ON TABLE public.infloww_daily_stats FROM anon, authenticated';
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

COMMENT ON TABLE public.infloww_daily_stats IS
  'Cached daily Infloww employee sales + chat metrics per user/performer (synced via cron / admin backfill)';
