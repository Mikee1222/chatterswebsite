-- Daily Review ownership: stable manager_id + Realtime publication
-- Spot Checks already have manager_id; Daily Reviews only had manager_name.

ALTER TABLE public.marketing_daily_reviews
  ADD COLUMN IF NOT EXISTS manager_id text;

CREATE INDEX IF NOT EXISTS idx_marketing_daily_reviews_manager_id
  ON public.marketing_daily_reviews (manager_id);

-- Backfill manager_id from users (prefer airtable_id, fall back to uuid text)
UPDATE public.marketing_daily_reviews dr
SET manager_id = COALESCE(NULLIF(trim(u.airtable_id), ''), u.id::text)
FROM public.users u
WHERE (dr.manager_id IS NULL OR trim(dr.manager_id) = '')
  AND dr.manager_name IS NOT NULL
  AND trim(dr.manager_name) <> ''
  AND (
    lower(trim(dr.manager_name)) = lower(trim(coalesce(u.full_name, '')))
    OR lower(trim(dr.manager_name)) = lower(trim(coalesce(u.email, '')))
  );

-- Unique ownership key: prefer (review_date, manager_id) when id is known
DROP INDEX IF EXISTS marketing_daily_reviews_review_date_manager_name_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS marketing_daily_reviews_review_date_manager_id_uidx
  ON public.marketing_daily_reviews (review_date, manager_id)
  WHERE manager_id IS NOT NULL AND trim(manager_id) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS marketing_daily_reviews_review_date_manager_name_uidx
  ON public.marketing_daily_reviews (review_date, manager_name)
  WHERE manager_id IS NULL OR trim(manager_id) = '';

-- Realtime: postgres_changes + invalidate trigger + authenticated SELECT (mirror spot checks)
DO $$
DECLARE
  t text := 'marketing_daily_reviews';
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
