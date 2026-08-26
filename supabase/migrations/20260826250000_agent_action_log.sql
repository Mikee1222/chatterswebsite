-- Gunzo Agent action audit log (proposed → confirmed → executed / cancelled / failed)

CREATE TABLE IF NOT EXISTS public.agent_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL CHECK (action_type IN ('read', 'action')),
  tool_name text NOT NULL,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  proposed_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  executed_by text NOT NULL,
  executed_by_name text,
  result jsonb,
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'confirmed', 'executed', 'failed', 'cancelled')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_action_log_executed_by_proposed
  ON public.agent_action_log (executed_by, proposed_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_action_log_status
  ON public.agent_action_log (status);

ALTER TABLE public.agent_action_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  BEGIN
    REVOKE ALL ON TABLE public.agent_action_log FROM anon, authenticated;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END $$;

COMMENT ON TABLE public.agent_action_log IS
  'Gunzo Agent audit trail: proposed actions require human confirm before execute.';
