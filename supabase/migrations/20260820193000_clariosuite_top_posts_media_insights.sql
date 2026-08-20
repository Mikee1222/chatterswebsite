-- Extended per-post ClarioSuite media insights (GET /api/v1/media/:id/insights).
-- Core reach/views/likes/comments/shares/saved already exist; add Reels/Carousel fields
-- plus sync diagnostics when Meta returns unavailable (e.g. ClarioSuite requesting unsupported metrics).

ALTER TABLE public.clariosuite_top_posts
  ADD COLUMN IF NOT EXISTS total_interactions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_views integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quartile_p95 numeric,
  ADD COLUMN IF NOT EXISTS carousel_album_engagement integer,
  ADD COLUMN IF NOT EXISTS carousel_album_impressions integer,
  ADD COLUMN IF NOT EXISTS carousel_album_reach integer,
  ADD COLUMN IF NOT EXISTS carousel_album_saved integer,
  ADD COLUMN IF NOT EXISTS insights_available boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS insights_error text;

COMMENT ON COLUMN public.clariosuite_top_posts.total_interactions IS
  'ClarioSuite MediaInsight.totalInteractions from GET /media/:id/insights.';
COMMENT ON COLUMN public.clariosuite_top_posts.video_views IS
  'ClarioSuite MediaInsight.videoViews (Reels) from GET /media/:id/insights.';
COMMENT ON COLUMN public.clariosuite_top_posts.quartile_p95 IS
  'ClarioSuite MediaInsight.quartileP95 (Reels watch retention) from GET /media/:id/insights.';
COMMENT ON COLUMN public.clariosuite_top_posts.insights_available IS
  'True when GET /media/:id/insights returned usable metrics (not status.source=unavailable).';
COMMENT ON COLUMN public.clariosuite_top_posts.insights_error IS
  'Upstream reason when media insights were unavailable (e.g. IG API metric rejection).';
