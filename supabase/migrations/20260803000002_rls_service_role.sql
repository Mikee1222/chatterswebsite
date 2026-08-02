-- =============================================================================
-- Phase 1 RLS: deny anon/authenticated by default; service role bypasses RLS.
-- App access goes through SUPABASE_SERVICE_ROLE_KEY on the server (same trust model
-- as Airtable PAT today). Refine per-role policies in a later phase to match
-- lib/permissions.ts once the data access layer is rewritten.
-- =============================================================================

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.table_name);
    -- No policies for anon/authenticated → no access.
    -- service_role bypasses RLS automatically in Supabase.
  END LOOP;
END $$;

-- Explicit revoke of table privileges from anon/authenticated (defense in depth).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
  LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', r.table_name);
    EXCEPTION WHEN undefined_object THEN
      -- roles may not exist outside Supabase; ignore
      NULL;
    END;
  END LOOP;
END $$;

COMMENT ON SCHEMA public IS
  'Gunzo OS / chatter-dashboard. Phase 1: service-role-only access via server.';
