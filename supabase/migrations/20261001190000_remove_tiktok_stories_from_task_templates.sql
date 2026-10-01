-- Discontinue TikTok Stories as an agency practice.
-- Removes TikTok Story checklist items from task_templates only.
-- Does NOT touch already-spawned va_task_phase_items / va_tasks.

-- Pure TikTok Story checklist items
DELETE FROM public.task_template_items
WHERE title IN (
  'Post Tik Tok Story',
  'Post TikTok Story (Daily)',
  'Post TikTok Story (CTA)'
)
OR title ~* '^Post Tik[[:space:]]*Tok Story';

-- Inactive combined reel+story items: keep reel, drop story wording
UPDATE public.task_template_items
SET title = 'Post reel (Tik Tok)',
    updated_at = NOW()
WHERE title = 'Post reel & daily story (Tik Tok)';
