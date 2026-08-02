-- Phase 2: allow custom RBAC role slugs from Airtable (roles table is source of truth).
-- Applied to remote project wagfkuxkrgsencartqtx via MCP; kept here for local parity.

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IS NULL OR (char_length(trim(role)) > 0 AND char_length(role) <= 64));
