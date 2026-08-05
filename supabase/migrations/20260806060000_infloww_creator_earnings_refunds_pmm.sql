-- Creator earnings extensions: refunds, renew-on, priority mass messages
-- Project: wagfkuxkrgsencartqtx (Gunzo)

ALTER TABLE public.infloww_creator_daily_stats
  ADD COLUMN IF NOT EXISTS fans_with_renew_on integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.infloww_creator_daily_stats.fans_with_renew_on IS
  'Count of fans with auto-renew enabled from GET /v1/creator-report/fans/renew-on.';

CREATE TABLE IF NOT EXISTS public.infloww_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id text NOT NULL,
  transaction_id text NOT NULL,
  creator_infloww_id text NOT NULL,
  model_record_id text,
  model_stable_id text,
  fan_id text,
  payment_amount numeric NOT NULL DEFAULT 0,
  transaction_type text,
  payment_status text,
  currency text NOT NULL DEFAULT 'USD',
  payment_time timestamptz,
  refund_time timestamptz NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT infloww_refunds_refund_id_key UNIQUE (refund_id)
);

CREATE INDEX IF NOT EXISTS infloww_refunds_creator_refund_time_idx
  ON public.infloww_refunds (creator_infloww_id, refund_time DESC);
CREATE INDEX IF NOT EXISTS infloww_refunds_transaction_id_idx
  ON public.infloww_refunds (transaction_id);
CREATE INDEX IF NOT EXISTS infloww_refunds_model_record_idx
  ON public.infloww_refunds (model_record_id)
  WHERE model_record_id IS NOT NULL;

COMMENT ON TABLE public.infloww_refunds IS
  'Infloww creator refunds from GET /v1/refunds. Unique on refund_id (Infloww row id).';

CREATE TABLE IF NOT EXISTS public.infloww_priority_mass_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  priority_mass_message_id text NOT NULL,
  creator_infloww_id text NOT NULL,
  model_record_id text,
  model_stable_id text,
  employee_id text,
  status text,
  price numeric NOT NULL DEFAULT 0,
  revenue numeric NOT NULL DEFAULT 0,
  number_of_times_sent integer NOT NULL DEFAULT 0,
  number_of_purchases integer NOT NULL DEFAULT 0,
  targeting_rules jsonb,
  message_preview text,
  currency text NOT NULL DEFAULT 'USD',
  created_time timestamptz,
  sent_time timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT infloww_priority_mass_messages_pmm_id_key UNIQUE (priority_mass_message_id)
);

CREATE INDEX IF NOT EXISTS infloww_pmm_creator_sent_idx
  ON public.infloww_priority_mass_messages (creator_infloww_id, sent_time DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS infloww_pmm_employee_idx
  ON public.infloww_priority_mass_messages (employee_id, sent_time DESC NULLS LAST)
  WHERE employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS infloww_pmm_model_record_idx
  ON public.infloww_priority_mass_messages (model_record_id)
  WHERE model_record_id IS NOT NULL;

COMMENT ON TABLE public.infloww_priority_mass_messages IS
  'Priority mass message campaigns from GET /v1/priority-mass-messages. Unique on priorityMassMessageId.';

ALTER TABLE public.infloww_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.infloww_priority_mass_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'REVOKE ALL ON TABLE public.infloww_refunds FROM anon, authenticated';
  EXECUTE 'REVOKE ALL ON TABLE public.infloww_priority_mass_messages FROM anon, authenticated';
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;
