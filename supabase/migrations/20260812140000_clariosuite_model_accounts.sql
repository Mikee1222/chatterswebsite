-- Multi Instagram account linking per model + extra revenue sub_username

-- ---------------------------------------------------------------------------
-- clariosuite_model_accounts — one row per linked IG account
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clariosuite_model_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id text NOT NULL,
  clariosuite_ig_user_id text NOT NULL,
  account_label text NOT NULL DEFAULT 'Main',
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clariosuite_model_accounts_ig_uidx UNIQUE (clariosuite_ig_user_id),
  CONSTRAINT clariosuite_model_accounts_model_ig_key UNIQUE (model_id, clariosuite_ig_user_id)
);

CREATE INDEX IF NOT EXISTS clariosuite_model_accounts_model_id_idx
  ON public.clariosuite_model_accounts (model_id);

CREATE INDEX IF NOT EXISTS clariosuite_model_accounts_primary_idx
  ON public.clariosuite_model_accounts (model_id)
  WHERE is_primary = true;

COMMENT ON TABLE public.clariosuite_model_accounts IS
  'Instagram accounts linked to a model via ClarioSuite. Exactly one is_primary per model.';

-- Tag synced insight rows with account reference (ig_user_id remains canonical key)
ALTER TABLE public.clariosuite_daily_insights
  ADD COLUMN IF NOT EXISTS clariosuite_model_account_id uuid
    REFERENCES public.clariosuite_model_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.clariosuite_audience_snapshots
  ADD COLUMN IF NOT EXISTS clariosuite_model_account_id uuid
    REFERENCES public.clariosuite_model_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.clariosuite_top_posts
  ADD COLUMN IF NOT EXISTS clariosuite_model_account_id uuid
    REFERENCES public.clariosuite_model_accounts(id) ON DELETE SET NULL;

-- Backfill primary "Main" from deprecated modelss.clariosuite_ig_user_id
INSERT INTO public.clariosuite_model_accounts (model_id, clariosuite_ig_user_id, account_label, is_primary)
SELECT
  COALESCE(NULLIF(trim(m.airtable_id), ''), m.id::text),
  trim(m.clariosuite_ig_user_id),
  'Main',
  true
FROM public.modelss m
WHERE m.clariosuite_ig_user_id IS NOT NULL
  AND trim(m.clariosuite_ig_user_id) <> ''
ON CONFLICT (clariosuite_ig_user_id) DO NOTHING;

-- Link existing insight rows to backfilled accounts
UPDATE public.clariosuite_daily_insights d
SET clariosuite_model_account_id = a.id
FROM public.clariosuite_model_accounts a
WHERE d.clariosuite_model_account_id IS NULL
  AND d.ig_user_id = a.clariosuite_ig_user_id;

UPDATE public.clariosuite_audience_snapshots s
SET clariosuite_model_account_id = a.id
FROM public.clariosuite_model_accounts a
WHERE s.clariosuite_model_account_id IS NULL
  AND s.ig_user_id = a.clariosuite_ig_user_id;

UPDATE public.clariosuite_top_posts p
SET clariosuite_model_account_id = a.id
FROM public.clariosuite_model_accounts a
WHERE p.clariosuite_model_account_id IS NULL
  AND p.ig_user_id = a.clariosuite_ig_user_id;

ALTER TABLE public.clariosuite_model_accounts ENABLE ROW LEVEL SECURITY;

-- Extra revenue: subscriber username on fines_and_bonuses
ALTER TABLE public.fines_and_bonuses
  ADD COLUMN IF NOT EXISTS sub_username text;

COMMENT ON COLUMN public.fines_and_bonuses.sub_username IS
  'Subscriber username for chatter extra revenue submissions (matches rebills/tips pattern).';
