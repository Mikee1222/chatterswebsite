-- Granular per-event notification preference overrides (Settings → Categories expand).
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS event_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;
