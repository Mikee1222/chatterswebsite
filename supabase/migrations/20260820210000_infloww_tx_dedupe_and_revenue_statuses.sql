-- Creator Earnings Net Profit was overstated vs Infloww "Total earnings" because:
-- 1) GET /v1/transactions (hex transaction_id) and /v1/transaction-perf (numeric id)
--    were stored as separate rows for the same payment (twin.infloww_row_id = canonical.transaction_id).
-- 2) Revenue aggregates only counted status=done, but Infloww Total earnings also includes loading.

-- Drop ONLY hex list-endpoint twins (32-char hex ids). Do NOT delete numeric perf rows
-- whose infloww_row_id happens to equal another payment's transaction_id.
DELETE FROM public.infloww_transactions AS twin
WHERE twin.transaction_id ~ '^[a-f0-9]{32}$'
  AND twin.infloww_row_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.infloww_transactions AS canonical
    WHERE canonical.transaction_id = twin.infloww_row_id
      AND canonical.transaction_id IS DISTINCT FROM twin.transaction_id
  );

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
  WHERE t.status IN ('done', 'loading')
    AND t.model_record_id IS NOT NULL
    AND t.created_time >= (p_start_ymd::timestamp AT TIME ZONE 'Europe/Athens')
    AND t.created_time < ((p_end_ymd::date + 1)::timestamp AT TIME ZONE 'Europe/Athens')
    -- Exclude leftover hex list twins only (numeric perf rows can share id namespaces)
    AND NOT (
      t.transaction_id ~ '^[a-f0-9]{32}$'
      AND EXISTS (
        SELECT 1
        FROM public.infloww_transactions o
        WHERE o.transaction_id = t.infloww_row_id
          AND o.transaction_id IS DISTINCT FROM t.transaction_id
      )
    )
  GROUP BY t.model_record_id, ((t.created_time AT TIME ZONE 'Europe/Athens')::date)
  ORDER BY day ASC;
$$;

GRANT EXECUTE ON FUNCTION public.infloww_creator_revenue_by_athens_day(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.infloww_creator_revenue_by_athens_day(text, text) TO authenticated;
