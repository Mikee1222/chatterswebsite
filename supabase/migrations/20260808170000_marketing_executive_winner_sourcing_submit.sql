-- Marketing Executive FAB "Add a Winner / Super Winner" requires winner_sourcing:submit.
-- Role only had winner_videos:submit (legacy Research flow) — distinct permission, never
-- stored for marketing-executive after winner_sourcing shipped. Idempotent append.

UPDATE public.roles
SET
  permissions = (COALESCE(permissions::jsonb, '[]'::jsonb) || '"winner_sourcing:submit"'::jsonb)::text,
  updated_at = now()
WHERE role_id = 'marketing-executive'
  AND NOT (COALESCE(permissions::jsonb, '[]'::jsonb) ? 'winner_sourcing:submit');
