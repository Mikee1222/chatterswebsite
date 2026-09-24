-- Client portal scoped lookups were full-table scans + in-memory filters.
-- GIN indexes on uuid[] link columns + Infloww model/date composites.

CREATE INDEX IF NOT EXISTS idx_client_models_client_gin
  ON public.client_models USING gin (client);

CREATE INDEX IF NOT EXISTS idx_client_models_model_gin
  ON public.client_models USING gin (model);

CREATE INDEX IF NOT EXISTS idx_billing_cycles_client_gin
  ON public.billing_cycles USING gin (client);

CREATE INDEX IF NOT EXISTS idx_billing_cycle_revenues_client_gin
  ON public.billing_cycle_revenues USING gin (client);

CREATE INDEX IF NOT EXISTS idx_billing_cycle_revenues_status
  ON public.billing_cycle_revenues (status);

CREATE INDEX IF NOT EXISTS idx_payment_submissions_client_gin
  ON public.payment_submissions USING gin (client);

CREATE INDEX IF NOT EXISTS idx_payment_submissions_billing_cycle_gin
  ON public.payment_submissions USING gin (billing_cycle);

CREATE INDEX IF NOT EXISTS idx_invoices_client_gin
  ON public.invoices USING gin (client);

CREATE INDEX IF NOT EXISTS idx_calendar_events_client_gin
  ON public.calendar_events USING gin (client);

CREATE INDEX IF NOT EXISTS idx_calendar_events_scope
  ON public.calendar_events (scope);

CREATE INDEX IF NOT EXISTS idx_payment_methods_scope_available
  ON public.payment_methods (scope, is_available);

CREATE INDEX IF NOT EXISTS idx_payment_methods_client_gin
  ON public.payment_methods USING gin (client);

CREATE INDEX IF NOT EXISTS idx_custom_requests_assigned_model_gin
  ON public.custom_requests USING gin (assigned_model);

CREATE INDEX IF NOT EXISTS idx_va_content_assignments_model_gin
  ON public.va_content_assignments USING gin (model);

CREATE INDEX IF NOT EXISTS infloww_transactions_model_created_idx
  ON public.infloww_transactions (model_record_id, created_time DESC);

CREATE INDEX IF NOT EXISTS infloww_creator_daily_stats_model_date_idx
  ON public.infloww_creator_daily_stats (model_record_id, date);

CREATE INDEX IF NOT EXISTS infloww_refunds_model_refund_time_idx
  ON public.infloww_refunds (model_record_id, refund_time DESC);

CREATE INDEX IF NOT EXISTS infloww_marketing_links_model_id_idx
  ON public.infloww_marketing_links (model_id);
