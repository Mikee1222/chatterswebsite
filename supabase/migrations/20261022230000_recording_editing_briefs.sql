-- Recording Briefs + Editing Briefs (Creative Director structured briefs).
-- Service-role-only RLS (same trust model as posting_briefs).

-- ── Recording Briefs ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.recording_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  model_id text NOT NULL DEFAULT '',
  reference_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'urgent')),
  deadline_at timestamptz,
  concept_why text NOT NULL DEFAULT '',
  setup_camera text NOT NULL DEFAULT '',
  setup_framing text NOT NULL DEFAULT '',
  setup_location text NOT NULL DEFAULT '',
  setup_outfit text NOT NULL DEFAULT '',
  setup_light text NOT NULL DEFAULT '',
  setup_sound text NOT NULL DEFAULT '',
  setup_notes text NOT NULL DEFAULT '',
  how_to_talk text NOT NULL DEFAULT '',
  how_to_act text NOT NULL DEFAULT '',
  props text NOT NULL DEFAULT '',
  checklist_before_upload text NOT NULL DEFAULT '',
  upload_path text NOT NULL DEFAULT '',
  clip_naming text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'uploaded', 'archived')),
  created_by text NOT NULL DEFAULT '',
  reminder_sent_at timestamptz,
  overdue_alerted_at timestamptz,
  uploaded_at timestamptz,
  uploaded_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recording_briefs_model_id_idx
  ON public.recording_briefs (model_id);
CREATE INDEX IF NOT EXISTS recording_briefs_status_idx
  ON public.recording_briefs (status);
CREATE INDEX IF NOT EXISTS recording_briefs_priority_idx
  ON public.recording_briefs (priority);
CREATE INDEX IF NOT EXISTS recording_briefs_deadline_at_idx
  ON public.recording_briefs (deadline_at);
CREATE INDEX IF NOT EXISTS recording_briefs_created_at_idx
  ON public.recording_briefs (created_at DESC);

CREATE TABLE IF NOT EXISTS public.recording_brief_variations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id uuid NOT NULL REFERENCES public.recording_briefs (id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  name text NOT NULL DEFAULT '',
  script_shot_list text NOT NULL DEFAULT '',
  takes integer NOT NULL DEFAULT 2,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recording_brief_variations_brief_id_idx
  ON public.recording_brief_variations (brief_id, position);

ALTER TABLE public.recording_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_brief_variations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  REVOKE ALL ON TABLE public.recording_briefs FROM anon, authenticated;
  REVOKE ALL ON TABLE public.recording_brief_variations FROM anon, authenticated;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

COMMENT ON TABLE public.recording_briefs IS
  'Structured recording briefs from Creative Director to Creators (models). Service-role-only.';
COMMENT ON TABLE public.recording_brief_variations IS
  'Per-variation rows for a recording brief (script/shot list, takes, notes).';

-- ── Editing Briefs ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.editing_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  model_id text NOT NULL DEFAULT '',
  reference_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'urgent')),
  deadline_at timestamptz,
  deliverables_count integer NOT NULL DEFAULT 1,
  recording_brief_id uuid REFERENCES public.recording_briefs (id) ON DELETE SET NULL,
  assigned_editor_id text NOT NULL DEFAULT '',
  concept text NOT NULL DEFAULT '',
  raw_footage_path text NOT NULL DEFAULT '',
  raw_files_takes text NOT NULL DEFAULT '',
  cut_rules text NOT NULL DEFAULT '',
  audio_voice text NOT NULL DEFAULT 'keep_voice'
    CHECK (audio_voice IN ('keep_voice', 'mute_original', 'clean_up')),
  audio_music boolean NOT NULL DEFAULT false,
  audio_notes text NOT NULL DEFAULT '',
  text_graphics jsonb NOT NULL DEFAULT '[]'::jsonb,
  do_not_add text NOT NULL DEFAULT '',
  export_width integer NOT NULL DEFAULT 1080,
  export_height integer NOT NULL DEFAULT 1920,
  export_fps integer NOT NULL DEFAULT 30,
  export_format text NOT NULL DEFAULT 'MP4',
  upload_path_finals text NOT NULL DEFAULT '',
  final_check text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'delivered', 'approved', 'changes_needed', 'archived')),
  reviewer_comment text NOT NULL DEFAULT '',
  created_by text NOT NULL DEFAULT '',
  reminder_sent_at timestamptz,
  overdue_alerted_at timestamptz,
  delivered_at timestamptz,
  delivered_by text,
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS editing_briefs_model_id_idx
  ON public.editing_briefs (model_id);
CREATE INDEX IF NOT EXISTS editing_briefs_status_idx
  ON public.editing_briefs (status);
CREATE INDEX IF NOT EXISTS editing_briefs_priority_idx
  ON public.editing_briefs (priority);
CREATE INDEX IF NOT EXISTS editing_briefs_deadline_at_idx
  ON public.editing_briefs (deadline_at);
CREATE INDEX IF NOT EXISTS editing_briefs_assigned_editor_id_idx
  ON public.editing_briefs (assigned_editor_id);
CREATE INDEX IF NOT EXISTS editing_briefs_recording_brief_id_idx
  ON public.editing_briefs (recording_brief_id);
CREATE INDEX IF NOT EXISTS editing_briefs_created_at_idx
  ON public.editing_briefs (created_at DESC);

CREATE TABLE IF NOT EXISTS public.editing_brief_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id uuid NOT NULL REFERENCES public.editing_briefs (id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  output_name text NOT NULL DEFAULT '',
  raw_take text NOT NULL DEFAULT '',
  special_instructions text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS editing_brief_videos_brief_id_idx
  ON public.editing_brief_videos (brief_id, position);

ALTER TABLE public.editing_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editing_brief_videos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  REVOKE ALL ON TABLE public.editing_briefs FROM anon, authenticated;
  REVOKE ALL ON TABLE public.editing_brief_videos FROM anon, authenticated;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

COMMENT ON TABLE public.editing_briefs IS
  'Structured editing briefs from Creative Director to Editors. Service-role-only. Coexists with bunch-pipeline Editor assignments.';
COMMENT ON TABLE public.editing_brief_videos IS
  'Per-video output rows for an editing brief.';

-- ── Reminder lead-time setting (default 3 hours) ──────────────────────────────

INSERT INTO public.system_settings (setting_key, setting_value, description)
SELECT
  'brief_reminder_lead_hours',
  '3',
  'Hours before deadline to send Recording/Editing Brief reminder (admin-editable).'
WHERE NOT EXISTS (
  SELECT 1 FROM public.system_settings WHERE setting_key = 'brief_reminder_lead_hours'
);

-- ── Opt-in permission grants (mirrors posting_briefs pattern) ─────────────────

UPDATE public.roles
SET
  permissions = (COALESCE(permissions::jsonb, '[]'::jsonb)
    || '"recording_briefs:manage"'::jsonb
    || '"editing_briefs:manage"'::jsonb)::text,
  updated_at = now()
WHERE role_id = 'creative'
  AND (
    NOT (COALESCE(permissions::jsonb, '[]'::jsonb) ? 'recording_briefs:manage')
    OR NOT (COALESCE(permissions::jsonb, '[]'::jsonb) ? 'editing_briefs:manage')
  );

UPDATE public.roles
SET
  permissions = (COALESCE(permissions::jsonb, '[]'::jsonb)
    || '"recording_briefs:view_own"'::jsonb)::text,
  updated_at = now()
WHERE role_id = 'model'
  AND NOT (COALESCE(permissions::jsonb, '[]'::jsonb) ? 'recording_briefs:view_own');

UPDATE public.roles
SET
  permissions = (COALESCE(permissions::jsonb, '[]'::jsonb)
    || '"editing_briefs:view_assigned"'::jsonb)::text,
  updated_at = now()
WHERE role_id = 'editor'
  AND NOT (COALESCE(permissions::jsonb, '[]'::jsonb) ? 'editing_briefs:view_assigned');

UPDATE public.roles
SET
  permissions = (COALESCE(permissions::jsonb, '[]'::jsonb)
    || '"recording_briefs:view_all"'::jsonb
    || '"editing_briefs:view_all"'::jsonb
    || '"editing_briefs:review"'::jsonb)::text,
  updated_at = now()
WHERE role_id IN ('admin', 'manager')
  AND (
    NOT (COALESCE(permissions::jsonb, '[]'::jsonb) ? 'recording_briefs:view_all')
    OR NOT (COALESCE(permissions::jsonb, '[]'::jsonb) ? 'editing_briefs:view_all')
    OR NOT (COALESCE(permissions::jsonb, '[]'::jsonb) ? 'editing_briefs:review')
  );
