-- Instagram Weekly Progress + Creator Earnings: date-range revenue queries were
-- doing Parallel Seq Scan on infloww_transactions (~99k rows, ~1.5s per 1000-row page).
-- Composite status+created_time index supports revenueOnly=true + created_time range.

CREATE INDEX IF NOT EXISTS infloww_transactions_status_created_idx
  ON public.infloww_transactions (status, created_time DESC);

CREATE INDEX IF NOT EXISTS infloww_transactions_created_time_idx
  ON public.infloww_transactions (created_time DESC);

ANALYZE public.infloww_transactions;
