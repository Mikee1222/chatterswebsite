-- Align tips/rebills with Airtable write shapes used by chatter APIs
ALTER TABLE public.tips
  ADD COLUMN IF NOT EXISTS sub_username text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS screenshot text[],
  ADD COLUMN IF NOT EXISTS amount_usd numeric;

ALTER TABLE public.rebills
  ADD COLUMN IF NOT EXISTS rebill_id text,
  ADD COLUMN IF NOT EXISTS chatter_id text,
  ADD COLUMN IF NOT EXISTS chatter_name text,
  ADD COLUMN IF NOT EXISTS model_id text,
  ADD COLUMN IF NOT EXISTS model_name text,
  ADD COLUMN IF NOT EXISTS sub_username text,
  ADD COLUMN IF NOT EXISTS sub_type text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz;
