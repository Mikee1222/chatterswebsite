-- Reason for going live (ad-hoc Start Live)
ALTER TABLE public.model_live_streams
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS reason_note text;

COMMENT ON COLUMN public.model_live_streams.reason IS
  'Why the model went live: going_out | gym | at_home | other';

COMMENT ON COLUMN public.model_live_streams.reason_note IS
  'Optional free-text note when reason = other';
