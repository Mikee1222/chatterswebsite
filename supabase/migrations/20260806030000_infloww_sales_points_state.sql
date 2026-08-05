-- Incremental Infloww sales → points cursor (avoids double-count on re-sync)
CREATE TABLE IF NOT EXISTS public.infloww_sales_points_state (
  user_id text PRIMARY KEY,
  user_uuid uuid,
  awarded_sales numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_infloww_sales_points_state_uuid
  ON public.infloww_sales_points_state (user_uuid);

ALTER TABLE public.infloww_sales_points_state ENABLE ROW LEVEL SECURITY;
