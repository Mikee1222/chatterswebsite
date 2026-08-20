-- Daily creator revenue aggregate for Instagram Weekly Progress cross-platform section.
-- Avoids paginating tens of thousands of infloww_transactions rows on every report load.
-- IMPORTANT: use timestamp AT TIME ZONE, not date AT TIME ZONE (PG date cast is wrong here).

CREATE OR REPLACE FUNCTION public.infloww_creator_revenue_by_athens_day(
  p_start_ymd text,
  p_end_ymd text
)
RETURNS TABLE (
  model_record_id text,
  day date,
  revenue numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    t.model_record_id::text,
    ((t.created_time AT TIME ZONE 'Europe/Athens')::date) AS day,
    SUM(
      CASE
        WHEN COALESCE(t.net, 0) > 0 THEN t.net
        ELSE GREATEST(
          0,
          COALESCE(t.amount, 0) - CASE WHEN COALESCE(t.fee, 0) > 0 THEN t.fee ELSE 0 END
        )
      END
    )::numeric AS revenue
  FROM public.infloww_transactions t
  WHERE t.status = 'done'
    AND t.model_record_id IS NOT NULL
    AND t.created_time >= (p_start_ymd::timestamp AT TIME ZONE 'Europe/Athens')
    AND t.created_time < ((p_end_ymd::date + 1)::timestamp AT TIME ZONE 'Europe/Athens')
  GROUP BY t.model_record_id, ((t.created_time AT TIME ZONE 'Europe/Athens')::date)
  ORDER BY day ASC;
$$;

GRANT EXECUTE ON FUNCTION public.infloww_creator_revenue_by_athens_day(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.infloww_creator_revenue_by_athens_day(text, text) TO authenticated;
