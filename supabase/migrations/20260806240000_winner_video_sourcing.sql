-- Winner Video sourcing + recreation planning (distinct from Research winner_videos flow).
-- Tables: video_bunches, winner_submissions, recreation_queue_items, recreate_video_slots.

CREATE TABLE IF NOT EXISTS public.video_bunches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  model_id text NOT NULL,
  model_name text NOT NULL DEFAULT '',
  target_video_count integer NOT NULL DEFAULT 30
    CHECK (target_video_count > 0),
  created_by_id text NOT NULL DEFAULT '',
  created_by_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_bunches_status ON public.video_bunches (status);
CREATE INDEX IF NOT EXISTS idx_video_bunches_model_id ON public.video_bunches (model_id);
CREATE INDEX IF NOT EXISTS idx_video_bunches_created_at ON public.video_bunches (created_at DESC);

CREATE TABLE IF NOT EXISTS public.winner_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id text NOT NULL,
  model_name text NOT NULL DEFAULT '',
  submitted_by_id text NOT NULL,
  submitted_by_name text NOT NULL DEFAULT '',
  video_link text NOT NULL,
  view_count integer NOT NULL CHECK (view_count >= 0),
  tier text NOT NULL CHECK (tier IN ('winner', 'super_winner')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'queued_for_recreation')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_winner_submissions_tier ON public.winner_submissions (tier);
CREATE INDEX IF NOT EXISTS idx_winner_submissions_status ON public.winner_submissions (status);
CREATE INDEX IF NOT EXISTS idx_winner_submissions_model_id ON public.winner_submissions (model_id);
CREATE INDEX IF NOT EXISTS idx_winner_submissions_submitted_by ON public.winner_submissions (submitted_by_id);
CREATE INDEX IF NOT EXISTS idx_winner_submissions_created_at ON public.winner_submissions (created_at DESC);

CREATE TABLE IF NOT EXISTS public.recreation_queue_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  winner_submission_id uuid NOT NULL REFERENCES public.winner_submissions (id) ON DELETE CASCADE,
  bunch_id uuid REFERENCES public.video_bunches (id) ON DELETE SET NULL,
  required_recreate_count integer NOT NULL CHECK (required_recreate_count > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (winner_submission_id)
);

CREATE INDEX IF NOT EXISTS idx_recreation_queue_bunch ON public.recreation_queue_items (bunch_id);
CREATE INDEX IF NOT EXISTS idx_recreation_queue_created_at ON public.recreation_queue_items (created_at DESC);

CREATE TABLE IF NOT EXISTS public.recreate_video_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bunch_id uuid NOT NULL REFERENCES public.video_bunches (id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('from_winner', 'researcher_submitted')),
  sequence_number integer NOT NULL DEFAULT 1 CHECK (sequence_number > 0),
  description text NOT NULL DEFAULT '',
  video_link text NOT NULL DEFAULT '',
  video_type text NOT NULL DEFAULT ''
    CHECK (video_type IN ('', 'skit', 'ugc', 'other')),
  -- Aligned with Creative Scripts lifecycle (lib/creative-scripts-helpers.ts SCRIPT_STATUSES)
  status text NOT NULL DEFAULT 'Not Applicable'
    CHECK (status IN (
      'Not Applicable',
      'Needs Script',
      'Pending Review',
      'Approved',
      'Rejected'
    )),
  assigned_creative_id text,
  assigned_creative_name text NOT NULL DEFAULT '',
  winner_submission_id uuid REFERENCES public.winner_submissions (id) ON DELETE SET NULL,
  -- Linked Creative Scripts work item on public.winner_videos (Research table, reused for scripts)
  winner_video_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recreate_slots_bunch ON public.recreate_video_slots (bunch_id);
CREATE INDEX IF NOT EXISTS idx_recreate_slots_status ON public.recreate_video_slots (status);
CREATE INDEX IF NOT EXISTS idx_recreate_slots_creative ON public.recreate_video_slots (assigned_creative_id);
CREATE INDEX IF NOT EXISTS idx_recreate_slots_winner_sub ON public.recreate_video_slots (winner_submission_id);
CREATE INDEX IF NOT EXISTS idx_recreate_slots_winner_video ON public.recreate_video_slots (winner_video_id);

-- Phase 1 RLS: service-role only (matches 20260803000002_rls_service_role.sql).
ALTER TABLE public.video_bunches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winner_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recreation_queue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recreate_video_slots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  BEGIN
    REVOKE ALL ON TABLE public.video_bunches FROM anon, authenticated;
    REVOKE ALL ON TABLE public.winner_submissions FROM anon, authenticated;
    REVOKE ALL ON TABLE public.recreation_queue_items FROM anon, authenticated;
    REVOKE ALL ON TABLE public.recreate_video_slots FROM anon, authenticated;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END $$;
