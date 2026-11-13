-- Seed mistakes:submit for roles that can already submit mistakes today
-- (anyone with mistakes:view, including virtual_assistant). Idempotent append;
-- never removes existing grants. Admin also receives it via ALL_PERMISSIONS in code.

UPDATE public.roles
SET
  permissions = (COALESCE(permissions::jsonb, '[]'::jsonb) || '"mistakes:submit"'::jsonb)::text,
  updated_at = now()
WHERE (
    role_id = 'virtual_assistant'
    OR COALESCE(permissions::jsonb, '[]'::jsonb) ? 'mistakes:view'
  )
  AND NOT (COALESCE(permissions::jsonb, '[]'::jsonb) ? 'mistakes:submit');
