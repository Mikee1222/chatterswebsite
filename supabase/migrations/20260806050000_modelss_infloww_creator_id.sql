-- Stable Infloww creator id for modelss (distinct from app-internal model_id)
ALTER TABLE public.modelss
  ADD COLUMN IF NOT EXISTS infloww_creator_id text;

COMMENT ON COLUMN public.modelss.infloww_creator_id IS
  'Infloww creator id (from GET /v1/creators id). Distinct from app-stable model_id (model_* slug). Used for reliable creator earnings sync.';

CREATE UNIQUE INDEX IF NOT EXISTS modelss_infloww_creator_id_uidx
  ON public.modelss (infloww_creator_id)
  WHERE infloww_creator_id IS NOT NULL AND trim(infloww_creator_id) <> '';
