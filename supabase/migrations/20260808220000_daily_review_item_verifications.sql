-- Daily Review live checklist verification (QA overlay on VA task_phase_items).
-- One row per (supervisor daily_review, checklist item). Does NOT auto-create Mistakes.

CREATE TABLE IF NOT EXISTS public.daily_review_item_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_time timestamptz DEFAULT now(),
  review_id uuid NOT NULL REFERENCES public.marketing_daily_reviews (id) ON DELETE CASCADE,
  task_phase_item_id text NOT NULL,
  task_id text NOT NULL DEFAULT '',
  phase_id text NOT NULL DEFAULT '',
  va_id text NOT NULL DEFAULT '',
  va_name text NOT NULL DEFAULT '',
  item_title text NOT NULL DEFAULT '',
  verified_status text NOT NULL
    CHECK (verified_status IN ('verified', 'flagged_not_done')),
  verified_by text NOT NULL DEFAULT '',
  verified_by_name text NOT NULL DEFAULT '',
  verified_at timestamptz NOT NULL DEFAULT now(),
  note text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (review_id, task_phase_item_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_review_item_verifications_review_id
  ON public.daily_review_item_verifications (review_id);

CREATE INDEX IF NOT EXISTS idx_daily_review_item_verifications_va_id
  ON public.daily_review_item_verifications (va_id);

CREATE INDEX IF NOT EXISTS idx_daily_review_item_verifications_status
  ON public.daily_review_item_verifications (verified_status);

CREATE INDEX IF NOT EXISTS idx_daily_review_item_verifications_item
  ON public.daily_review_item_verifications (task_phase_item_id);

CREATE INDEX IF NOT EXISTS idx_daily_review_item_verifications_verified_at
  ON public.daily_review_item_verifications (verified_at DESC);

ALTER TABLE public.daily_review_item_verifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  BEGIN
    REVOKE ALL ON TABLE public.daily_review_item_verifications FROM anon, authenticated;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END $$;

-- Realtime invalidate (optional; mirrors marketing_daily_reviews pattern when helper exists)
DO $$
DECLARE
  t text := 'daily_review_item_verifications';
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
