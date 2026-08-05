-- Normalize golden_ratio to fraction 0–1 (PPVs sent ÷ messages).
-- Infloww chat-summary historically stored percent values (e.g. 7.32 = 7.32%).
-- Prefer recomputing from counts so aggregates stay authoritative.

COMMENT ON COLUMN public.infloww_daily_stats.golden_ratio IS
  'Golden Ratio as fraction 0–1 (PPVs sent ÷ messages). Infloww healthy band ~4–10%. Synced from chat-summary goldenRatio (percent) and/or recomputed.';

UPDATE public.infloww_daily_stats
SET golden_ratio = CASE
  WHEN messages_sent > 0 THEN (ppvs_sent::numeric / messages_sent::numeric)
  ELSE NULL
END
WHERE messages_sent > 0
   OR golden_ratio IS NOT NULL;
