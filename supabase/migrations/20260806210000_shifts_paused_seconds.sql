-- VA task shift pause/resume: accumulate non-working seconds separately from wall-clock.
-- Pause state continues to use status=on_break + break_started_at (existing columns).
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS paused_seconds numeric DEFAULT 0;

COMMENT ON COLUMN public.shifts.paused_seconds IS
  'Accumulated pause/break seconds for active-time duration (excludes open pause while on_break).';
