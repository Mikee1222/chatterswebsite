-- Top Fans aggregate for admin model page.
-- Groups infloww_transactions by fan for one model without shipping raw rows to the app.
-- Owner must apply this migration (Gunzo project may not be reachable via MCP).
--
-- Revenue statuses match CREATOR_TX_REVENUE_STATUSES: done + loading.
-- Net formula matches creatorTxRevenueAmount / other infloww RPCs.
-- Hex-twin dedupe matches infloww_creator_tx_type_counts.

CREATE OR REPLACE FUNCTION public.infloww_model_top_fans(
  p_model_id text,
  p_start_iso timestamptz DEFAULT NULL,
  p_end_iso timestamptz DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_inactive_only boolean DEFAULT false,
  p_inactive_min_net numeric DEFAULT 100,
  p_inactive_days integer DEFAULT 14,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS json
LANGUAGE sql
STABLE
AS $$
  WITH base AS (
    SELECT
      t.fan_id::text AS fan_id,
      NULLIF(trim(COALESCE(t.fan_name, '')), '') AS fan_name,
      t.created_time,
      lower(trim(COALESCE(t.type, ''))) AS type_l,
      CASE
        WHEN COALESCE(t.net, 0) > 0 THEN t.net
        ELSE GREATEST(
          0,
          COALESCE(t.amount, 0) - CASE WHEN COALESCE(t.fee, 0) > 0 THEN t.fee ELSE 0 END
        )
      END AS revenue
    FROM public.infloww_transactions t
    WHERE t.status IN ('done', 'loading')
      AND t.fan_id IS NOT NULL
      AND NULLIF(trim(t.fan_id), '') IS NOT NULL
      AND (
        t.model_record_id = p_model_id
        OR t.model_stable_id = p_model_id
      )
      AND (p_start_iso IS NULL OR t.created_time >= p_start_iso)
      AND (p_end_iso IS NULL OR t.created_time <= p_end_iso)
      AND NOT (
        t.transaction_id ~ '^[a-f0-9]{32}$'
        AND EXISTS (
          SELECT 1
          FROM public.infloww_transactions o
          WHERE o.transaction_id = t.infloww_row_id
            AND o.transaction_id IS DISTINCT FROM t.transaction_id
        )
      )
  ),
  per_fan AS (
    SELECT
      b.fan_id,
      COALESCE(
        MAX(b.fan_name) FILTER (WHERE b.fan_name IS NOT NULL),
        b.fan_id
      ) AS fan_name,
      SUM(b.revenue)::numeric AS net,
      COUNT(*)::bigint AS purchase_count,
      MAX(b.created_time) AS last_purchase_at,
      SUM(b.revenue) FILTER (
        WHERE b.type_l LIKE '%tip%'
      )::numeric AS tips_net,
      SUM(b.revenue) FILTER (
        WHERE b.type_l LIKE '%message%'
          OR b.type_l LIKE '%msg%'
          OR b.type_l LIKE '%ppv%'
          OR b.type_l = 'chat'
      )::numeric AS messages_net,
      SUM(b.revenue) FILTER (
        WHERE b.type_l LIKE '%sub%'
      )::numeric AS subscription_net,
      SUM(b.revenue) FILTER (
        WHERE b.type_l LIKE '%post%'
      )::numeric AS posts_net
    FROM base b
    GROUP BY b.fan_id
  ),
  filtered AS (
    SELECT *
    FROM per_fan f
    WHERE (
      p_search IS NULL
      OR trim(p_search) = ''
      OR f.fan_name ILIKE '%' || trim(p_search) || '%'
      OR f.fan_id ILIKE '%' || trim(p_search) || '%'
    )
    AND (
      NOT p_inactive_only
      OR (
        f.net >= COALESCE(p_inactive_min_net, 100)
        AND f.last_purchase_at < (now() - make_interval(days => GREATEST(COALESCE(p_inactive_days, 14), 1)))
      )
    )
  ),
  ranked AS (
    SELECT
      f.*,
      ROW_NUMBER() OVER (ORDER BY f.net DESC, f.last_purchase_at DESC NULLS LAST, f.fan_id) AS rn
    FROM filtered f
  ),
  summary AS (
    SELECT
      COUNT(*)::bigint AS fan_count,
      COALESCE(SUM(net), 0)::numeric AS total_net,
      CASE
        WHEN COALESCE(SUM(net), 0) > 0 THEN
          (
            SELECT COALESCE(SUM(r.net), 0)
            FROM ranked r
            WHERE r.rn <= 10
          ) / SUM(net)
        ELSE 0
      END::numeric AS top10_net_share
    FROM filtered
  ),
  page AS (
    SELECT
      r.fan_id,
      r.fan_name,
      r.net,
      r.purchase_count,
      r.last_purchase_at,
      COALESCE(r.tips_net, 0)::numeric AS tips_net,
      COALESCE(r.messages_net, 0)::numeric AS messages_net,
      COALESCE(r.subscription_net, 0)::numeric AS subscription_net,
      COALESCE(r.posts_net, 0)::numeric AS posts_net
    FROM ranked r
    WHERE r.rn > GREATEST(COALESCE(p_offset, 0), 0)
      AND r.rn <= GREATEST(COALESCE(p_offset, 0), 0) + GREATEST(LEAST(COALESCE(p_limit, 100), 500), 1)
    ORDER BY r.rn
  )
  SELECT json_build_object(
    'summary', json_build_object(
      'fan_count', (SELECT fan_count FROM summary),
      'total_net', (SELECT total_net FROM summary),
      'top10_net_share', (SELECT top10_net_share FROM summary)
    ),
    'fans', COALESCE((SELECT json_agg(to_jsonb(p)) FROM page p), '[]'::json),
    'has_more', (
      SELECT COUNT(*) > GREATEST(COALESCE(p_offset, 0), 0) + GREATEST(LEAST(COALESCE(p_limit, 100), 500), 1)
      FROM filtered
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.infloww_model_top_fans(
  text, timestamptz, timestamptz, text, boolean, numeric, integer, integer, integer
) TO service_role;

COMMENT ON FUNCTION public.infloww_model_top_fans IS
  'Admin model Top Fans: fan-level net/purchase aggregates from infloww_transactions (done+loading).';
