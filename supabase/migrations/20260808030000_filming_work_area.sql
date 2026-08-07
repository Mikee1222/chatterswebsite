-- Filmer work area: script briefs, bunch filming assignment, slot filmed flags, filming calendar.

-- Optional creative brief (alongside script_text / text_on_screen_suggestion).
ALTER TABLE public.winner_videos
  ADD COLUMN IF NOT EXISTS script_brief text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.winner_videos.script_brief IS
  'Optional creative brief for filming — visible to admin after approve and to assigned filmers.';

-- Bunch-level filming assignment + upload confirmation.
ALTER TABLE public.video_bunches
  ADD COLUMN IF NOT EXISTS assigned_filmer_id text,
  ADD COLUMN IF NOT EXISTS assigned_filmer_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS filming_status text NOT NULL DEFAULT 'unassigned',
  ADD COLUMN IF NOT EXISTS upload_folder_link text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS uploaded_at timestamptz;

ALTER TABLE public.video_bunches
  DROP CONSTRAINT IF EXISTS video_bunches_filming_status_check;

ALTER TABLE public.video_bunches
  ADD CONSTRAINT video_bunches_filming_status_check
  CHECK (filming_status IN ('unassigned', 'assigned', 'in_progress', 'uploaded'));

CREATE INDEX IF NOT EXISTS idx_video_bunches_assigned_filmer
  ON public.video_bunches (assigned_filmer_id);

CREATE INDEX IF NOT EXISTS idx_video_bunches_filming_status
  ON public.video_bunches (filming_status);

COMMENT ON COLUMN public.video_bunches.assigned_filmer_id IS
  'Staff with filming:view_assignments assigned to film this bunch after all scripts are approved.';
COMMENT ON COLUMN public.video_bunches.filming_status IS
  'unassigned | assigned | in_progress | uploaded';

-- Per-slot filmed checklist.
ALTER TABLE public.recreate_video_slots
  ADD COLUMN IF NOT EXISTS filmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS filmed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_recreate_video_slots_filmed
  ON public.recreate_video_slots (bunch_id, filmed);

-- Admin-managed filming calendar (models see shoots via synced model_schedule rows).
CREATE TABLE IF NOT EXISTS public.filming_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_date date NOT NULL,
  start_time text NOT NULL DEFAULT '',
  end_time text NOT NULL DEFAULT '',
  model_id text NOT NULL,
  model_name text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_by_id text NOT NULL DEFAULT '',
  created_by_name text NOT NULL DEFAULT '',
  model_schedule_item_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_filming_schedule_date
  ON public.filming_schedule (schedule_date);

CREATE INDEX IF NOT EXISTS idx_filming_schedule_model
  ON public.filming_schedule (model_id);

COMMENT ON TABLE public.filming_schedule IS
  'Filming shoots calendar — admin CRUD; filmers read-only; synced into model_schedule for models.';

-- Realtime for live Hub filming progress.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['video_bunches', 'recreate_video_slots', 'filming_schedule']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
