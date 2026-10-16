-- Posting Briefs: Creative Director → Marketing Executive structured posting instructions.
-- Service-role-only RLS (same trust model as other app tables).

CREATE TABLE IF NOT EXISTS public.posting_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  model_id text NOT NULL DEFAULT '',
  account_handle text NOT NULL DEFAULT '',
  account_type text NOT NULL DEFAULT 'main'
    CHECK (account_type IN ('main', 'secondary')),
  region text NOT NULL DEFAULT 'Global'
    CHECK (region IN ('USA', 'Greece', 'Global')),
  content_type text NOT NULL DEFAULT 'Trial Reels'
    CHECK (content_type IN ('Trial Reels', 'Reels', 'Stories', 'Carousel', 'Other')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'urgent')),
  instructions_notes text NOT NULL DEFAULT '',
  video_location_path text NOT NULL DEFAULT '',
  sound_name text NOT NULL DEFAULT '',
  sound_link text NOT NULL DEFAULT '',
  sound_notes text NOT NULL DEFAULT '',
  text_style_notes text NOT NULL DEFAULT '',
  timing_notes text NOT NULL DEFAULT '',
  final_checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS posting_briefs_model_id_idx
  ON public.posting_briefs (model_id);
CREATE INDEX IF NOT EXISTS posting_briefs_status_idx
  ON public.posting_briefs (status);
CREATE INDEX IF NOT EXISTS posting_briefs_priority_idx
  ON public.posting_briefs (priority);
CREATE INDEX IF NOT EXISTS posting_briefs_account_handle_idx
  ON public.posting_briefs (account_handle);
CREATE INDEX IF NOT EXISTS posting_briefs_created_at_idx
  ON public.posting_briefs (created_at DESC);

CREATE TABLE IF NOT EXISTS public.posting_brief_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id uuid NOT NULL REFERENCES public.posting_briefs (id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  video_name text NOT NULL DEFAULT '',
  text_on_screen text,
  caption text NOT NULL DEFAULT '',
  pinned_comment text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS posting_brief_posts_brief_id_idx
  ON public.posting_brief_posts (brief_id, position);

ALTER TABLE public.posting_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posting_brief_posts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  REVOKE ALL ON TABLE public.posting_briefs FROM anon, authenticated;
  REVOKE ALL ON TABLE public.posting_brief_posts FROM anon, authenticated;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

COMMENT ON TABLE public.posting_briefs IS
  'Structured posting briefs from Creative Director to Marketing Executives. Service-role-only.';
COMMENT ON TABLE public.posting_brief_posts IS
  'Per-post rows for a posting brief (video, text on screen, caption, etc.).';

-- Grant manage to Creative Director role (`creative`); view to Marketing Executive roles.
UPDATE public.roles
SET
  permissions = (COALESCE(permissions::jsonb, '[]'::jsonb) || '"posting_briefs:manage"'::jsonb)::text,
  updated_at = now()
WHERE role_id = 'creative'
  AND NOT (COALESCE(permissions::jsonb, '[]'::jsonb) ? 'posting_briefs:manage');

UPDATE public.roles
SET
  permissions = (COALESCE(permissions::jsonb, '[]'::jsonb) || '"posting_briefs:view"'::jsonb)::text,
  updated_at = now()
WHERE role_id IN (
    'marketing-executive',
    'marketing-executives-us',
    'marketing-executive_copy'
  )
  AND NOT (COALESCE(permissions::jsonb, '[]'::jsonb) ? 'posting_briefs:view');
