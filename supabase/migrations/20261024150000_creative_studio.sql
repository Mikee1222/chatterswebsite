-- AI Creative Studio: saved ideas + generation support tables (service-role-only).

CREATE TABLE IF NOT EXISTS public.creative_studio_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id text NOT NULL,
  idea_type text NOT NULL DEFAULT 'caption'
    CHECK (idea_type IN ('caption', 'text_on_screen', 'video_analysis')),
  platform text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_favourite boolean NOT NULL DEFAULT false,
  thumbs smallint NOT NULL DEFAULT 0
    CHECK (thumbs IN (-1, 0, 1)),
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creative_studio_ideas_model_id_idx
  ON public.creative_studio_ideas (model_id, created_at DESC);
CREATE INDEX IF NOT EXISTS creative_studio_ideas_thumbs_idx
  ON public.creative_studio_ideas (model_id, thumbs)
  WHERE thumbs = 1;

CREATE TABLE IF NOT EXISTS public.creative_studio_video_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id text NOT NULL,
  frame_hashes text[] NOT NULL DEFAULT '{}',
  analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  cover_thumbnail_base64 text,
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creative_studio_video_analyses_model_id_idx
  ON public.creative_studio_video_analyses (model_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.creative_studio_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  call_count integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, window_start)
);

ALTER TABLE public.creative_studio_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_studio_video_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_studio_rate_limits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  REVOKE ALL ON TABLE public.creative_studio_ideas FROM anon, authenticated;
  REVOKE ALL ON TABLE public.creative_studio_video_analyses FROM anon, authenticated;
  REVOKE ALL ON TABLE public.creative_studio_rate_limits FROM anon, authenticated;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

COMMENT ON TABLE public.creative_studio_ideas IS
  'Saved Creative Studio outputs per model. Thumbs-up rows feed few-shot examples.';
COMMENT ON TABLE public.creative_studio_video_analyses IS
  'Video analysis results: perceptual hashes + JSON only (no video/frames stored long-term).';
COMMENT ON TABLE public.creative_studio_rate_limits IS
  'Per-user rate limit windows for Creative Studio AI calls.';
