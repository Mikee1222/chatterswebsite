-- Per-model Story CTA Link A/B URLs for the fixed weekly rotation schedule (VA Tasks widget).

CREATE TABLE IF NOT EXISTS public.model_story_link_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id text NOT NULL,
  link_a_url text,
  link_b_url text,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_story_link_config_model_id_key UNIQUE (model_id)
);

CREATE INDEX IF NOT EXISTS model_story_link_config_model_id_idx
  ON public.model_story_link_config (model_id);

COMMENT ON TABLE public.model_story_link_config IS
  'Per-model Link A/B URLs for the weekly Instagram Story CTA rotation (Mon/Wed/Sat = A, Wed = B).';

ALTER TABLE public.model_story_link_config ENABLE ROW LEVEL SECURITY;
