-- Fast transaction-type aggregates for Admin Home (avoids fetchAll row scans).

CREATE OR REPLACE FUNCTION public.infloww_creator_tx_type_counts(
  p_start_ymd text,
  p_end_ymd text
)
RETURNS TABLE (
  type text,
  count bigint,
  gross numeric,
  net numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(NULLIF(trim(t.type), ''), 'unknown') AS type,
    COUNT(*)::bigint AS count,
    SUM(COALESCE(t.amount, 0))::numeric AS gross,
    SUM(
      CASE
        WHEN COALESCE(t.net, 0) > 0 THEN t.net
        ELSE GREATEST(
          0,
          COALESCE(t.amount, 0) - CASE WHEN COALESCE(t.fee, 0) > 0 THEN t.fee ELSE 0 END
        )
      END
    )::numeric AS net
  FROM public.infloww_transactions t
  WHERE t.status IN ('done', 'loading')
    AND t.created_time >= (p_start_ymd::timestamp AT TIME ZONE 'Europe/Athens')
    AND t.created_time < ((p_end_ymd::date + 1)::timestamp AT TIME ZONE 'Europe/Athens')
    AND NOT (
      t.transaction_id ~ '^[a-f0-9]{32}$'
      AND EXISTS (
        SELECT 1
        FROM public.infloww_transactions o
        WHERE o.transaction_id = t.infloww_row_id
          AND o.transaction_id IS DISTINCT FROM t.transaction_id
      )
    )
  GROUP BY COALESCE(NULLIF(trim(t.type), ''), 'unknown')
  ORDER BY count DESC;
$$;

GRANT EXECUTE ON FUNCTION public.infloww_creator_tx_type_counts(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.infloww_creator_tx_type_counts(text, text) TO authenticated;
