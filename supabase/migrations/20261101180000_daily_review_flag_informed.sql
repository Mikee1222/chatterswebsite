-- Daily Review: track when a manager/admin informed a person about flagged items.
-- Per (review_date, va_id). Service-role only — app APIs enforce RBAC + scope.

CREATE TABLE IF NOT EXISTS public.daily_review_flag_informed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_time timestamptz DEFAULT now(),
  review_date date NOT NULL,
  va_id text NOT NULL,
  va_name text NOT NULL DEFAULT '',
  informed_by text NOT NULL DEFAULT '',
  informed_by_name text NOT NULL DEFAULT '',
  informed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (review_date, va_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_review_flag_informed_date
  ON public.daily_review_flag_informed (review_date);

CREATE INDEX IF NOT EXISTS idx_daily_review_flag_informed_va_id
  ON public.daily_review_flag_informed (va_id);

CREATE INDEX IF NOT EXISTS idx_daily_review_flag_informed_informed_at
  ON public.daily_review_flag_informed (informed_at DESC);

ALTER TABLE public.daily_review_flag_informed ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  BEGIN
    REVOKE ALL ON TABLE public.daily_review_flag_informed FROM anon, authenticated;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END $$;

-- Optional realtime invalidate (mirrors other daily-review tables)
DO $$
DECLARE
  t text := 'daily_review_flag_informed';
  trig text;
  pol text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
  ) THEN
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'gunzo_realtime_invalidate'
  ) THEN
    trig := 'gunzo_rt_invalidate_' || t;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trig, t);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.gunzo_realtime_invalidate()',
      trig, t
    );
  END IF;

  pol := 'gunzo_realtime_select_authenticated';
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
    pol, t
  );
END $$;
