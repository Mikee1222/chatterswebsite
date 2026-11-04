-- Rebills no longer require verification: default to verified, sweep leftover pending.
-- Keep pending/rejected in CHECK so historical rows remain valid.
-- Null status (legacy Airtable imports) left untouched.

ALTER TABLE public.rebills
  ALTER COLUMN status SET DEFAULT 'verified';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rebills_status_check'
      AND conrelid = 'public.rebills'::regclass
  ) THEN
    ALTER TABLE public.rebills
      ADD CONSTRAINT rebills_status_check
      CHECK (status IS NULL OR status IN ('pending', 'verified', 'rejected'));
  END IF;
END $$;

UPDATE public.rebills
SET status = 'verified'
WHERE status = 'pending';
