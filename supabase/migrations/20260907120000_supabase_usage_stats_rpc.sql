-- Usage stats for Integration Health + Pro-plan quota monitoring.
-- Reads storage.objects metadata (file sizes) + pg_database_size + key table sizes.
-- Service-role only — do not expose to anon/authenticated.

CREATE OR REPLACE FUNCTION public.get_supabase_usage_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage, pg_catalog
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'generated_at', now(),
    'db_bytes', pg_database_size(current_database()),
    'storage_bytes', (
      SELECT COALESCE(SUM((o.metadata->>'size')::bigint), 0)
      FROM storage.objects o
    ),
    'buckets', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', b.name,
          'objects', COALESCE(s.object_count, 0),
          'bytes', COALESCE(s.total_bytes, 0)
        )
        ORDER BY COALESCE(s.total_bytes, 0) DESC
      )
      FROM storage.buckets b
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::bigint AS object_count,
          COALESCE(SUM((o.metadata->>'size')::bigint), 0)::bigint AS total_bytes
        FROM storage.objects o
        WHERE o.bucket_id = b.id
      ) s ON true
    ), '[]'::jsonb),
    'tables', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', x.table_name,
          'approx_rows', x.approx_rows,
          'total_bytes', x.total_bytes
        )
        ORDER BY x.total_bytes DESC
      )
      FROM (
        SELECT
          c.relname AS table_name,
          COALESCE(s.n_live_tup, 0)::bigint AS approx_rows,
          pg_total_relation_size(c.oid)::bigint AS total_bytes
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relname IN (
            'infloww_transactions',
            'notifications',
            'getmysocial_visitor_events',
            'clariosuite_top_posts',
            'credential_access_log',
            'agent_action_log',
            'application_form_responses',
            'infloww_daily_stats',
            'clariosuite_daily_insights',
            'activity_logs'
          )
      ) x
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_supabase_usage_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_supabase_usage_stats() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_supabase_usage_stats() TO service_role;

COMMENT ON FUNCTION public.get_supabase_usage_stats() IS
  'DB + Storage usage snapshot for admin Integration Health quota monitoring.';
