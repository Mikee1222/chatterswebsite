-- Airtable approval fields added after initial schema dump (scripts/add-va-assignment-approval-fields.ts).
-- Assigned VAs remain M2M via `va uuid[]` + join table `va_content_assignment_vas` (no va_id/model_id text cols).
ALTER TABLE public.va_content_assignments
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS admin_edit_notes text,
  ADD COLUMN IF NOT EXISTS reviewed_by text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

COMMENT ON COLUMN public.va_content_assignments.rejection_reason IS 'Airtable parity: approval workflow rejection reason';
COMMENT ON COLUMN public.va_content_assignments.admin_edit_notes IS 'Airtable parity: admin edit notes on approve';
COMMENT ON COLUMN public.va_content_assignments.reviewed_by IS 'Airtable parity: reviewer label';
COMMENT ON COLUMN public.va_content_assignments.reviewed_at IS 'Airtable parity: review timestamp';
