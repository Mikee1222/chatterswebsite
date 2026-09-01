#!/usr/bin/env npx tsx
/** Emit idempotent SQL for Greek Marketing Executive SOP role + functions (no DO block — batch-friendly). */
import { MARKETING_EXECUTIVE_FUNCTIONS } from "@/lib/sop-seed/marketing-executive-functions";

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

const dept = "1c6713c4-ffa4-468e-bc2f-bb972cd24182";

console.log(`-- Marketing Executive SOP role + ${MARKETING_EXECUTIVE_FUNCTIONS.length} functions

INSERT INTO public.sop_roles (
  role_id, name, slug, color, department, auth_roles, academy_mode, sort_order, is_active, created_at, updated_at
)
SELECT
  'sop_role_marketing_executive',
  'Marketing Executive',
  'marketing-executive',
  'blue',
  ARRAY['${dept}']::uuid[],
  ARRAY['marketing-executive']::text[],
  true,
  COALESCE((SELECT MAX(sort_order) FROM public.sop_roles), 0) + 1,
  true,
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM public.sop_roles WHERE slug = 'marketing-executive');

UPDATE public.sop_roles SET
  name = 'Marketing Executive',
  auth_roles = ARRAY['marketing-executive']::text[],
  academy_mode = true,
  department = ARRAY['${dept}']::uuid[],
  color = 'blue',
  is_active = true,
  updated_at = now()
WHERE slug = 'marketing-executive';
`);

for (const fn of MARKETING_EXECUTIVE_FUNCTIONS) {
  console.log(`
INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_${fn.sort_order}',
  '${esc(fn.name)}',
  '${esc(fn.kpi)}',
  'text',
  '${esc(fn.sop_content)}',
  '${fn.cadence_type}',
  '${esc(fn.cadence_note)}',
  ${fn.sort_order},
  ARRAY['${dept}']::uuid[],
  ARRAY[r.id]::uuid[],
  true,
  1,
  now(),
  now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND NOT EXISTS (
    SELECT 1 FROM public.sop_functions f
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = ${fn.sort_order}
  );

UPDATE public.sop_functions f SET
  name = '${esc(fn.name)}',
  kpi = '${esc(fn.kpi)}',
  sop_content = '${esc(fn.sop_content)}',
  cadence_type = '${fn.cadence_type}',
  cadence_note = '${esc(fn.cadence_note)}',
  department = ARRAY['${dept}']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = ${fn.sort_order};
`);
}
