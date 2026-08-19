-- Backfill va_task_phase_items.step_type where recurring clone stored 'Other'
-- but the checklist title clearly maps to a real category (Daily Marketing Routine).
-- Intentional template "Other" rows (Tik Tok scroll / repost) are excluded.

UPDATE va_task_phase_items
SET step_type = CASE
  WHEN lower(trim(title)) LIKE '%mobile data%' OR lower(trim(title)) LIKE '%ip check%' THEN 'IP Check'
  WHEN lower(trim(title)) LIKE '%scroll time%'
    AND lower(trim(title)) NOT LIKE '%tik tok%' THEN 'Warm-up'
  WHEN lower(trim(title)) LIKE 'post %'
    OR lower(trim(title)) LIKE '% post %'
    OR lower(trim(title)) LIKE '%story%'
    OR lower(trim(title)) LIKE '%reel%'
    OR lower(trim(title)) LIKE '%spotlight%'
    OR lower(trim(title)) LIKE '%cta story%' THEN 'Posting'
  WHEN lower(trim(title)) LIKE '%follow%'
    OR lower(trim(title)) LIKE '%friend%'
    OR lower(trim(title)) LIKE '%engagement%'
    OR lower(trim(title)) LIKE '%reply%'
    OR lower(trim(title)) LIKE '%comment%'
    OR lower(trim(title)) LIKE '%accept%' THEN 'Engagement'
  ELSE step_type
END
WHERE step_type = 'Other'
  AND lower(trim(title)) NOT LIKE '%tik tok scroll%'
  AND lower(trim(title)) NOT LIKE '%repost 2 tik tok%';
