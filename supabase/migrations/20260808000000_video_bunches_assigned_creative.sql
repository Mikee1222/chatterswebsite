-- Winner sourcing: assign creatives at video_bunches level (not per recreate_video_slots).
-- Slot assigned_creative_* columns remain as denormalized / historical attribution;
-- new & not-started slots inherit from the parent bunch.

ALTER TABLE public.video_bunches
  ADD COLUMN IF NOT EXISTS assigned_creative_id text,
  ADD COLUMN IF NOT EXISTS assigned_creative_name text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_video_bunches_assigned_creative
  ON public.video_bunches (assigned_creative_id);

-- Backfill: take the most recently updated assigned slot per bunch.
UPDATE public.video_bunches b
SET
  assigned_creative_id = s.assigned_creative_id,
  assigned_creative_name = COALESCE(s.assigned_creative_name, ''),
  updated_at = now()
FROM (
  SELECT DISTINCT ON (bunch_id)
    bunch_id,
    assigned_creative_id,
    assigned_creative_name
  FROM public.recreate_video_slots
  WHERE assigned_creative_id IS NOT NULL
    AND btrim(assigned_creative_id) <> ''
  ORDER BY bunch_id, updated_at DESC NULLS LAST, created_at DESC
) s
WHERE b.id = s.bunch_id
  AND (b.assigned_creative_id IS NULL OR btrim(b.assigned_creative_id) = '');

COMMENT ON COLUMN public.video_bunches.assigned_creative_id IS
  'Creative who owns scripting for all slots in this bunch. Source of truth for assignment.';
COMMENT ON COLUMN public.recreate_video_slots.assigned_creative_id IS
  'Deprecated as assignment source of truth — derived from parent bunch for not-started slots; retained for historical attribution after script submit.';
