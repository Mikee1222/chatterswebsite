-- =============================================================================
-- Supabase Realtime enablement + query indexes (Preview / DATA_BACKEND=supabase)
--
-- 1) Add high-churn tables to supabase_realtime publication (postgres_changes)
-- 2) Lightweight public broadcast triggers (invalidate-only payloads) so the
--    browser can live-update without SELECT RLS on app tables (service-role
--    data access stays server-side; clients re-fetch via existing APIs)
-- 3) Optional authenticated SELECT policies for postgres_changes when the app
--    mints a short-lived Supabase JWT (SUPABASE_JWT_SECRET)
-- 4) Indexes on status / date / FK columns used in dual-backend WHERE filters
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Publication: postgres_changes
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'notifications',
    'va_tasks',
    'va_task_phases',
    'va_task_phase_items',
    'shifts',
    'shift_models',
    'winner_videos',
    'custom_requests',
    'weekly_program',
    'weekly_program_va',
    'marketing_spot_checks',
    'model_social_accounts'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Broadcast invalidate helpers (public topics — no row PII in payload)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gunzo_realtime_invalidate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
  row_id text;
  scope_user text;
BEGIN
  row_id := COALESCE(NEW.id::text, OLD.id::text);

  IF TG_TABLE_NAME = 'notifications' THEN
    scope_user := COALESCE(NEW.user_id, OLD.user_id);
  ELSIF TG_TABLE_NAME = 'shifts' THEN
    scope_user := COALESCE(NEW.chatter_id, OLD.chatter_id);
  ELSIF TG_TABLE_NAME = 'winner_videos' THEN
    scope_user := COALESCE(NEW.submitted_by_id, OLD.submitted_by_id);
  ELSE
    scope_user := NULL;
  END IF;

  payload := jsonb_build_object(
    'table', TG_TABLE_NAME,
    'event', TG_OP,
    'id', row_id,
    'user_id', to_jsonb(scope_user)
  );

  -- private := false → public channel; clients subscribe with anon key and
  -- re-fetch via authenticated Next.js APIs (no direct table SELECT needed).
  PERFORM realtime.send(payload, 'invalidate', 'gunzo-live:' || TG_TABLE_NAME, false);
  PERFORM realtime.send(payload, 'invalidate', 'gunzo-live:all', false);

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.gunzo_realtime_invalidate() IS
  'Broadcasts lightweight invalidate events for Gunzo live UI (no full row payload).';

DO $$
DECLARE
  t text;
  trig text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'notifications',
    'va_tasks',
    'va_task_phases',
    'va_task_phase_items',
    'shifts',
    'shift_models',
    'winner_videos',
    'custom_requests',
    'weekly_program',
    'weekly_program_va',
    'marketing_spot_checks',
    'model_social_accounts'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      trig := 'gunzo_rt_invalidate_' || t;
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trig, t);
      EXECUTE format(
        'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.gunzo_realtime_invalidate()',
        trig, t
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Authenticated SELECT for postgres_changes (JWT role=authenticated only).
-- Anon remains revoked / no policies — PostgREST still cannot read app data.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  pol text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'notifications',
    'va_tasks',
    'va_task_phases',
    'va_task_phase_items',
    'shifts',
    'shift_models',
    'winner_videos',
    'custom_requests',
    'weekly_program',
    'weekly_program_va',
    'marketing_spot_checks',
    'model_social_accounts'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      pol := 'gunzo_realtime_select_authenticated';
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
        pol, t
      );
    END IF;
  END LOOP;
END $$;

-- Allow authenticated role to receive private broadcasts if used later.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'realtime' AND tablename = 'messages'
  ) THEN
    DROP POLICY IF EXISTS gunzo_authenticated_receive_broadcast ON realtime.messages;
    CREATE POLICY gunzo_authenticated_receive_broadcast
      ON realtime.messages
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
  NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Performance indexes (IF NOT EXISTS — safe on re-run)
-- ---------------------------------------------------------------------------

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON public.notifications (user_id, is_read);

-- va_tasks
CREATE INDEX IF NOT EXISTS idx_va_tasks_status ON public.va_tasks (status);
CREATE INDEX IF NOT EXISTS idx_va_tasks_due_date ON public.va_tasks (due_date);
CREATE INDEX IF NOT EXISTS idx_va_tasks_status_due ON public.va_tasks (status, due_date);
CREATE INDEX IF NOT EXISTS idx_va_tasks_assigned_to_gin ON public.va_tasks USING gin (assigned_to);

-- va_task_phases / items
CREATE INDEX IF NOT EXISTS idx_va_task_phases_task_id ON public.va_task_phases (task_id);
CREATE INDEX IF NOT EXISTS idx_va_task_phases_status ON public.va_task_phases (status);
CREATE INDEX IF NOT EXISTS idx_va_task_phases_assigned_va ON public.va_task_phases (assigned_va_id);
CREATE INDEX IF NOT EXISTS idx_va_task_phases_scheduled ON public.va_task_phases (scheduled_time);
CREATE INDEX IF NOT EXISTS idx_va_task_phase_items_phase_id ON public.va_task_phase_items (phase_id);
CREATE INDEX IF NOT EXISTS idx_va_task_phase_items_task_id ON public.va_task_phase_items (task_id);
CREATE INDEX IF NOT EXISTS idx_va_task_phase_items_status ON public.va_task_phase_items (status);

-- shifts / shift_models
CREATE INDEX IF NOT EXISTS idx_shifts_status ON public.shifts (status);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON public.shifts (date);
CREATE INDEX IF NOT EXISTS idx_shifts_chatter_id ON public.shifts (chatter_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status_date ON public.shifts (status, date);
CREATE INDEX IF NOT EXISTS idx_shifts_staff_role_status ON public.shifts (staff_role, status);

-- winner_videos (creative scripts pipeline)
CREATE INDEX IF NOT EXISTS idx_winner_videos_status ON public.winner_videos (status);
CREATE INDEX IF NOT EXISTS idx_winner_videos_script_status ON public.winner_videos (script_status);
CREATE INDEX IF NOT EXISTS idx_winner_videos_submitted_at ON public.winner_videos (submitted_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_winner_videos_content_type ON public.winner_videos (content_type);
CREATE INDEX IF NOT EXISTS idx_winner_videos_assigned_creative
  ON public.winner_videos (assigned_creative_id);

-- custom_requests
CREATE INDEX IF NOT EXISTS idx_custom_requests_status ON public.custom_requests (status);
CREATE INDEX IF NOT EXISTS idx_custom_requests_admin_status ON public.custom_requests (admin_status);
CREATE INDEX IF NOT EXISTS idx_custom_requests_chatter_id ON public.custom_requests (chatter_id);
CREATE INDEX IF NOT EXISTS idx_custom_requests_created_at ON public.custom_requests (created_at DESC NULLS LAST);

-- weekly programs
CREATE INDEX IF NOT EXISTS idx_weekly_program_week_start ON public.weekly_program (week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_program_chatter_id ON public.weekly_program (chatter_id);
CREATE INDEX IF NOT EXISTS idx_weekly_program_va_week_start ON public.weekly_program_va (week_start);

-- marketing / spot checks
CREATE INDEX IF NOT EXISTS idx_marketing_spot_checks_status ON public.marketing_spot_checks (status);
CREATE INDEX IF NOT EXISTS idx_marketing_spot_checks_timestamp
  ON public.marketing_spot_checks ("timestamp" DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_marketing_spot_checks_manager_id
  ON public.marketing_spot_checks (manager_id);
CREATE INDEX IF NOT EXISTS idx_marketing_spot_checks_exec_va_id
  ON public.marketing_spot_checks (exec_va_id);

-- model social accounts (VA marketing)
CREATE INDEX IF NOT EXISTS idx_model_social_accounts_model_id
  ON public.model_social_accounts (model_id)
  WHERE model_id IS NOT NULL;
