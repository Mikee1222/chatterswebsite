-- Posting Briefs: per-post "Posted" stage.
-- The Marketing Executive marks each post block as posted with the live link,
-- closing the Recording → Editing → Posting → Posted loop and giving the
-- Account Supervisor the link for the 24h check.

ALTER TABLE public.posting_brief_posts
  ADD COLUMN IF NOT EXISTS posted_url text,
  ADD COLUMN IF NOT EXISTS posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS posted_by text;

CREATE INDEX IF NOT EXISTS posting_brief_posts_posted_at_idx
  ON public.posting_brief_posts (posted_at DESC)
  WHERE posted_at IS NOT NULL;

COMMENT ON COLUMN public.posting_brief_posts.posted_url IS
  'Live post URL entered by the Marketing Executive when the post goes up.';
COMMENT ON COLUMN public.posting_brief_posts.posted_at IS
  'When the post was marked as posted (null = not posted yet).';
COMMENT ON COLUMN public.posting_brief_posts.posted_by IS
  'User id (Airtable user id or session id) who marked the post as posted.';
