-- Dual-backend schema gaps for remaining services
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS mistake_alerts boolean,
  ADD COLUMN IF NOT EXISTS fine_bonus_alerts boolean,
  ADD COLUMN IF NOT EXISTS period_alerts boolean,
  ADD COLUMN IF NOT EXISTS marketing_alerts boolean,
  ADD COLUMN IF NOT EXISTS phase_alerts boolean,
  ADD COLUMN IF NOT EXISTS reward_alerts boolean,
  ADD COLUMN IF NOT EXISTS custom_request_alerts boolean,
  ADD COLUMN IF NOT EXISTS billing_alerts boolean,
  ADD COLUMN IF NOT EXISTS training_alerts boolean,
  ADD COLUMN IF NOT EXISTS schedule_alerts boolean;

ALTER TABLE public.spin_wheel_prizes
  ADD COLUMN IF NOT EXISTS sort_order numeric;
