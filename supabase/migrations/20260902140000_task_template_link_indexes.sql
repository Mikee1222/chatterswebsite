-- Speed up template-scoped phase/item lookups (contains/overlaps on uuid[] link columns).
CREATE INDEX IF NOT EXISTS idx_task_template_phases_template
  ON public.task_template_phases USING GIN (template);

CREATE INDEX IF NOT EXISTS idx_task_template_items_phase_template
  ON public.task_template_items USING GIN (phase_template);
