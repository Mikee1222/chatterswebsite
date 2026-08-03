-- Match Airtable checkbox used by stuck-custom-request cron alerts
-- (services/custom-requests*.ts + runStuckCustomRequestAlerts).
ALTER TABLE public.custom_requests
  ADD COLUMN IF NOT EXISTS stuck_alert_sent boolean NOT NULL DEFAULT false;
