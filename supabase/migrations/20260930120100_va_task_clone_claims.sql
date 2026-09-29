-- Distributed clone mutex that works with pooled connections (session advisory locks do not).
CREATE TABLE IF NOT EXISTS public.va_task_clone_claims (
  task_id text PRIMARY KEY,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.va_task_clone_claims IS
  'Short-lived claim rows so only one clonePhasesToTask runs per target task across serverless instances.';

ALTER TABLE public.va_task_clone_claims ENABLE ROW LEVEL SECURITY;
