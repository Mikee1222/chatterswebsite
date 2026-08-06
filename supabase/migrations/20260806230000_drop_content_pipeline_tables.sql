-- Drop Content Pipeline tables (feature removed).
-- Decision: DROP (not archive) — content_items was empty; related rows were
-- smoke/dev drafts only (8 orphan content_item_events, 2 draft research_bunches,
-- 0 creator_assignments, 0 research_ideas).
-- VA Content Assignments + Custom Requests are unrelated and untouched.

DROP TABLE IF EXISTS public.content_item_events CASCADE;
DROP TABLE IF EXISTS public.content_items CASCADE;
DROP TABLE IF EXISTS public.research_ideas CASCADE;
DROP TABLE IF EXISTS public.research_bunches CASCADE;
DROP TABLE IF EXISTS public.creator_assignments CASCADE;
