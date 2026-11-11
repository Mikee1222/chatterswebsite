-- Reupload queue (trial-grid outlier → the SAME file reuploaded to the main grid).
-- The Marketing Manager notifies the assigned VAs; a VA reuploads, pastes the new
-- grid link and marks it done. From then on the entry is a grid post, not a trial.
ALTER TABLE public.recreation_queue_items
  ADD COLUMN IF NOT EXISTS reupload_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS reupload_notified_by text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reupload_url text,
  ADD COLUMN IF NOT EXISTS reupload_done_by text NOT NULL DEFAULT '',
  -- The trial post this entry came from. Kept so the nightly scan never
  -- re-detects the old trial post as a new outlier.
  ADD COLUMN IF NOT EXISTS original_trial_link text,
  ADD COLUMN IF NOT EXISTS original_trial_media_id text;
