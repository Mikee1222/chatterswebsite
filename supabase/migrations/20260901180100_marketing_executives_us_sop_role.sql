-- Marketing Executives US SOP role + 29 functions

INSERT INTO public.sop_roles (
  role_id, name, slug, color, department, auth_roles, academy_mode, sort_order, is_active, created_at, updated_at
)
SELECT
  'sop_role_marketing_executives_us',
  'Marketing Executives US',
  'marketing-executives-us',
  'blue',
  ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  ARRAY['marketing-executives-us']::text[],
  true,
  COALESCE((SELECT MAX(sort_order) FROM public.sop_roles), 0) + 1,
  true,
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM public.sop_roles WHERE slug = 'marketing-executives-us');

UPDATE public.sop_roles SET
  name = 'Marketing Executives US',
  auth_roles = ARRAY['marketing-executives-us']::text[],
  academy_mode = true,
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  color = 'blue',
  is_active = true,
  updated_at = now()
WHERE slug = 'marketing-executives-us';