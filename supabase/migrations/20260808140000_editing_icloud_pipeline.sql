-- Editor + iCloud Manager pipeline stages on video bunches / slots.

ALTER TABLE public.video_bunches
  ADD COLUMN IF NOT EXISTS assigned_editor_id text,
  ADD COLUMN IF NOT EXISTS assigned_editor_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS editing_status text NOT NULL DEFAULT 'unassigned',
  ADD COLUMN IF NOT EXISTS edited_upload_folder_link text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS edited_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS icloud_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS icloud_organized_at timestamptz;

ALTER TABLE public.video_bunches
  DROP CONSTRAINT IF EXISTS video_bunches_editing_status_check;

ALTER TABLE public.video_bunches
  ADD CONSTRAINT video_bunches_editing_status_check
  CHECK (editing_status IN ('unassigned', 'assigned', 'in_progress', 'uploaded'));

ALTER TABLE public.video_bunches
  DROP CONSTRAINT IF EXISTS video_bunches_icloud_status_check;

ALTER TABLE public.video_bunches
  ADD CONSTRAINT video_bunches_icloud_status_check
  CHECK (icloud_status IN ('pending', 'in_progress', 'organized'));

CREATE INDEX IF NOT EXISTS idx_video_bunches_assigned_editor
  ON public.video_bunches (assigned_editor_id);

CREATE INDEX IF NOT EXISTS idx_video_bunches_editing_status
  ON public.video_bunches (editing_status);

CREATE INDEX IF NOT EXISTS idx_video_bunches_icloud_status
  ON public.video_bunches (icloud_status);

COMMENT ON COLUMN public.video_bunches.assigned_editor_id IS
  'Staff with editing:view_assignments assigned after filming upload.';
COMMENT ON COLUMN public.video_bunches.editing_status IS
  'unassigned | assigned | in_progress | uploaded';
COMMENT ON COLUMN public.video_bunches.icloud_status IS
  'pending | in_progress | organized — available after editing_status=uploaded';

ALTER TABLE public.recreate_video_slots
  ADD COLUMN IF NOT EXISTS edited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_recreate_video_slots_edited
  ON public.recreate_video_slots (bunch_id, edited);

CREATE TABLE IF NOT EXISTS public.icloud_folder_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bunch_id uuid NOT NULL REFERENCES public.video_bunches(id) ON DELETE CASCADE,
  model_id text NOT NULL DEFAULT '',
  folder_label text NOT NULL DEFAULT '',
  folder_link text NOT NULL DEFAULT '',
  material_until_date date,
  created_by_id text NOT NULL DEFAULT '',
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_icloud_folder_entries_bunch
  ON public.icloud_folder_entries (bunch_id);

CREATE INDEX IF NOT EXISTS idx_icloud_folder_entries_model
  ON public.icloud_folder_entries (model_id);

CREATE INDEX IF NOT EXISTS idx_icloud_folder_entries_material_until
  ON public.icloud_folder_entries (material_until_date)
  WHERE material_until_date IS NOT NULL;

COMMENT ON TABLE public.icloud_folder_entries IS
  'iCloud organization folders per bunch — label, optional link, material runway date.';

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['icloud_folder_entries']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
