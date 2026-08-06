-- Researcher Fill Bunches (/winner-recreates) requires winner_sourcing:submit.
-- Custom role grants live in roles.permissions JSON; this was never stored
-- (Roles UI saves were blocked by stale-permission 400s until sanitizePermissions).
-- Idempotent: only appends if missing.

UPDATE public.roles
SET
  permissions = (COALESCE(permissions::jsonb, '[]'::jsonb) || '"winner_sourcing:submit"'::jsonb)::text,
  updated_at = now()
WHERE role_id = 'researcher'
  AND NOT (COALESCE(permissions::jsonb, '[]'::jsonb) ? 'winner_sourcing:submit');
