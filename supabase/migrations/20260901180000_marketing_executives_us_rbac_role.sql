-- Custom RBAC role for US Marketing Executives SOP Library track.
-- Mirrors marketing-executive permissions; idempotent.

INSERT INTO public.roles (
  role_id,
  label,
  description,
  permissions,
  notification_defaults,
  is_system_role,
  color,
  created_at,
  updated_at
)
SELECT
  'marketing-executives-us',
  'Marketing Executives US',
  'US-based marketing executive — social posting, account safety, winner sourcing, SOP Academy.',
  permissions,
  notification_defaults,
  false,
  'green',
  now(),
  now()
FROM public.roles
WHERE role_id = 'marketing-executive'
ON CONFLICT (role_id) DO NOTHING;
