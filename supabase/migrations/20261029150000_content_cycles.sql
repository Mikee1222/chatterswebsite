-- Content Flow v1.1: cycles (2 per month per model), Proven / Experimental bunches,
-- Recreation queue lanes + decisions, 24h outlier check on posted posts.
-- Builds on video_bunches / recreate_video_slots / winner_submissions / recreation_queue_items
-- and on posting_brief_posts.posted_* (per-post Posted stage).


-- Helper: drop every CHECK constraint that covers a given column (constraint names
-- are auto-generated in older migrations, so we resolve by column, not by name).
CREATE OR REPLACE FUNCTION pg_temp.drop_column_checks(p_table text, p_column text) RETURNS void AS $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
    WHERE con.contype = 'c' AND nsp.nspname = 'public'
      AND rel.relname = p_table AND att.attname = p_column
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', p_table, c.conname);
  END LOOP;
END $$ LANGUAGE plpgsql;

-- ── Cycles ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.content_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id text NOT NULL,
  model_name text NOT NULL DEFAULT '',
  number integer NOT NULL DEFAULT 1,
  start_date date NOT NULL,
  end_date date NOT NULL,
  proven_cap integer NOT NULL DEFAULT 30 CHECK (proven_cap > 0),
  experimental_cap integer NOT NULL DEFAULT 15 CHECK (experimental_cap >= 0),
  grid_per_day integer NOT NULL DEFAULT 3,
  trials_per_day integer NOT NULL DEFAULT 6,
  proven_bunch_id uuid REFERENCES public.video_bunches (id) ON DELETE SET NULL,
  experimental_bunch_id uuid REFERENCES public.video_bunches (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning', 'filling', 'briefing', 'shooting', 'posting', 'done')),
  notes text NOT NULL DEFAULT '',
  created_by_id text NOT NULL DEFAULT '',
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (model_id, number)
);
CREATE INDEX IF NOT EXISTS content_cycles_model_dates_idx
  ON public.content_cycles (model_id, start_date DESC);

-- Per-model cycle settings (caps, urgent slots). One row per model, created lazily.
CREATE TABLE IF NOT EXISTS public.content_cycle_settings (
  model_id text PRIMARY KEY,
  proven_cap integer NOT NULL DEFAULT 30,
  experimental_cap integer NOT NULL DEFAULT 15,
  grid_per_day integer NOT NULL DEFAULT 3,
  trials_per_day integer NOT NULL DEFAULT 6,
  urgent_slots_per_month integer NOT NULL DEFAULT 2,
  outlier_multiple numeric NOT NULL DEFAULT 2.5,
  hot_multiple numeric NOT NULL DEFAULT 10,
  baseline_posts integer NOT NULL DEFAULT 9,
  outlier_scan_days integer NOT NULL DEFAULT 20,
  updated_by text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Bunches: kind + cycle ────────────────────────────────────────────────────
ALTER TABLE public.video_bunches
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'proven',
  ADD COLUMN IF NOT EXISTS cycle_id uuid REFERENCES public.content_cycles (id) ON DELETE SET NULL;
SELECT pg_temp.drop_column_checks('video_bunches', 'kind');
ALTER TABLE public.video_bunches
  ADD CONSTRAINT video_bunches_kind_check CHECK (kind IN ('proven', 'experimental'));
CREATE INDEX IF NOT EXISTS idx_video_bunches_kind ON public.video_bunches (kind);
CREATE INDEX IF NOT EXISTS idx_video_bunches_cycle ON public.video_bunches (cycle_id);

-- ── Slots: experimental origin + recreation generation ───────────────────────
-- Existing values: from_winner | researcher_submitted — both still accepted.
SELECT pg_temp.drop_column_checks('recreate_video_slots', 'source');
ALTER TABLE public.recreate_video_slots
  ADD CONSTRAINT recreate_video_slots_source_check
  CHECK (source IN ('from_winner', 'researcher_submitted', 'experimental'));
ALTER TABLE public.recreate_video_slots
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS generation integer NOT NULL DEFAULT 0;
SELECT pg_temp.drop_column_checks('recreate_video_slots', 'origin');
ALTER TABLE public.recreate_video_slots
  ADD CONSTRAINT recreate_video_slots_origin_check
  CHECK (origin IN ('', 'trend', 'risky', 'seen', 'own_idea', 'recreation'));

-- ── Winner submissions: new source (24h check on our own posted post) ────────
-- Existing values: va_submitted | researcher_submitted | auto_detected — all still accepted.
SELECT pg_temp.drop_column_checks('winner_submissions', 'source');
ALTER TABLE public.winner_submissions
  ADD CONSTRAINT winner_submissions_source_check
  CHECK (source IN ('va_submitted', 'researcher_submitted', 'auto_detected', 'posted_24h'));
ALTER TABLE public.winner_submissions
  ADD COLUMN IF NOT EXISTS posting_brief_post_id uuid,
  ADD COLUMN IF NOT EXISTS feed text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS outlier_multiple numeric;

-- ── Recreation queue: lanes, decisions, generation ───────────────────────────
ALTER TABLE public.recreation_queue_items
  ADD COLUMN IF NOT EXISTS lane text NOT NULL DEFAULT 'next_bunch',
  ADD COLUMN IF NOT EXISTS decision text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS generation integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS feed text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS grid_posting_brief_id uuid,
  ADD COLUMN IF NOT EXISTS grid_posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS urgent_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS decided_by text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS decided_at timestamptz;
SELECT pg_temp.drop_column_checks('recreation_queue_items', 'lane');
ALTER TABLE public.recreation_queue_items
  ADD CONSTRAINT recreation_queue_items_lane_check CHECK (lane IN ('urgent', 'next_bunch'));
SELECT pg_temp.drop_column_checks('recreation_queue_items', 'decision');
ALTER TABLE public.recreation_queue_items
  ADD CONSTRAINT recreation_queue_items_decision_check
  CHECK (decision IN ('pending', 'grid', 'urgent', 'next_bunch', 'no'));

-- ── Posting posts: placement, source, 24h views ──────────────────────────────
ALTER TABLE public.posting_brief_posts
  ADD COLUMN IF NOT EXISTS placement text NOT NULL DEFAULT 'grid',
  ADD COLUMN IF NOT EXISTS content_source text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS views_24h integer,
  ADD COLUMN IF NOT EXISTS views_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS views_checked_by text,
  ADD COLUMN IF NOT EXISTS outlier_multiple numeric,
  ADD COLUMN IF NOT EXISTS outlier_status text NOT NULL DEFAULT '';
SELECT pg_temp.drop_column_checks('posting_brief_posts', 'placement');
ALTER TABLE public.posting_brief_posts
  ADD CONSTRAINT posting_brief_posts_placement_check CHECK (placement IN ('grid', 'trial'));
SELECT pg_temp.drop_column_checks('posting_brief_posts', 'content_source');
ALTER TABLE public.posting_brief_posts
  ADD CONSTRAINT posting_brief_posts_content_source_check
  CHECK (content_source IN ('', 'proven', 'experimental', 'recreation'));
SELECT pg_temp.drop_column_checks('posting_brief_posts', 'outlier_status');
ALTER TABLE public.posting_brief_posts
  ADD CONSTRAINT posting_brief_posts_outlier_status_check
  CHECK (outlier_status IN ('', 'normal', 'outlier', 'hot'));
CREATE INDEX IF NOT EXISTS posting_brief_posts_views_idx
  ON public.posting_brief_posts (posted_at DESC)
  WHERE views_24h IS NOT NULL;

ALTER TABLE public.content_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_cycle_settings ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  REVOKE ALL ON TABLE public.content_cycles FROM anon, authenticated;
  REVOKE ALL ON TABLE public.content_cycle_settings FROM anon, authenticated;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

-- Permissions: HoM manages the experimental bunch; admin gets it by default.
UPDATE public.roles
SET
  permissions = (COALESCE(permissions::jsonb, '[]'::jsonb)
    || '"experimental_bunch:manage"'::jsonb
    || '"content_cycles:manage"'::jsonb)::text,
  updated_at = now()
WHERE role_id = 'admin'
  AND NOT (COALESCE(permissions::jsonb, '[]'::jsonb) ? 'content_cycles:manage');
