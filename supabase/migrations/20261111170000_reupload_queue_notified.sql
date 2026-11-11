-- Reupload queue: remember when the Marketing Manager notified the assigned VAs
-- to reupload a trial-grid outlier to the main grid. Optional — the app works
-- without it (the "VAs notified" badge just does not persist).
ALTER TABLE public.recreation_queue_items
  ADD COLUMN IF NOT EXISTS reupload_notified_at timestamptz;
