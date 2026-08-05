-- Capture Infloww employee-chat-summary ppvsUnlocked / unlockRate (were previously dropped)
ALTER TABLE public.infloww_daily_stats
  ADD COLUMN IF NOT EXISTS ppvs_unlocked integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unlock_rate numeric;

COMMENT ON COLUMN public.infloww_daily_stats.ppvs_unlocked IS
  'PPVs unlocked from Infloww employee-chat-summary (ppvsUnlocked)';
COMMENT ON COLUMN public.infloww_daily_stats.unlock_rate IS
  'Unlock rate as fraction 0–1 from Infloww employee-chat-summary (unlockRate)';
