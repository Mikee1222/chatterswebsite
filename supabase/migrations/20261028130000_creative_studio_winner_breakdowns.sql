-- AI Creative Studio: Winner Breakdown (transcript + viral-element analysis).
-- Stores transcript text + structured JSON + small cover thumb only. Never the video.

CREATE TABLE IF NOT EXISTS public.creative_studio_winner_breakdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Model selected in the Studio when the breakdown ran (context only; breakdowns are creator-agnostic).
  model_id text,
  -- Optional link to a Fill Bunches winner row (set when started from a winner).
  winner_video_id text,
  title text NOT NULL DEFAULT '',
  source_url text NOT NULL DEFAULT '',
  source_caption text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  duration_sec numeric,
  transcript text NOT NULL DEFAULT '',
  transcript_segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  transcript_language text NOT NULL DEFAULT '',
  stt_model text NOT NULL DEFAULT '',
  frame_hashes text[] NOT NULL DEFAULT '{}',
  cover_thumbnail_base64 text,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  breakdown_model text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'success'
    CHECK (status IN ('success', 'refused', 'failed')),
  raw_model_response text,
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creative_studio_winner_breakdowns_created_idx
  ON public.creative_studio_winner_breakdowns (created_at DESC);
CREATE INDEX IF NOT EXISTS creative_studio_winner_breakdowns_model_idx
  ON public.creative_studio_winner_breakdowns (model_id, created_at DESC);
CREATE INDEX IF NOT EXISTS creative_studio_winner_breakdowns_winner_idx
  ON public.creative_studio_winner_breakdowns (winner_video_id)
  WHERE winner_video_id IS NOT NULL;

ALTER TABLE public.creative_studio_winner_breakdowns ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  REVOKE ALL ON TABLE public.creative_studio_winner_breakdowns FROM anon, authenticated;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

COMMENT ON TABLE public.creative_studio_winner_breakdowns IS
  'Creative Studio Winner Breakdowns: transcript + viral-element JSON per analysed video (service-role only).';

-- Draft sets generated from a breakdown (links to the created briefs).
ALTER TABLE public.creative_studio_winner_breakdowns
  ADD COLUMN IF NOT EXISTS draft_sets jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Posting briefs gain a Draft stage (CD prepares → MM/CD publishes → VAs see it)
-- and a link back to the editing brief they came from (FLOW strip).
-- Widen posting_briefs.status with 'draft'. Existing rows are 'active' | 'archived',
-- which the new CHECK still accepts. Drop whatever CHECK currently covers the column
-- (auto-named posting_briefs_status_check in 20261016220000, but resolved by column to be safe).
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
    WHERE con.contype = 'c' AND nsp.nspname = 'public'
      AND rel.relname = 'posting_briefs' AND att.attname = 'status'
  LOOP
    EXECUTE format('ALTER TABLE public.posting_briefs DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.posting_briefs
  ADD CONSTRAINT posting_briefs_status_check
  CHECK (status IN ('draft', 'active', 'archived'));
ALTER TABLE public.posting_briefs
  ADD COLUMN IF NOT EXISTS editing_brief_id uuid;
CREATE INDEX IF NOT EXISTS posting_briefs_editing_brief_idx
  ON public.posting_briefs (editing_brief_id)
  WHERE editing_brief_id IS NOT NULL;
