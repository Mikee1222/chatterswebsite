-- Allow NULL fans_with_renew_on when Infloww omits a creator/day from renew-on
-- (distinct from a genuine zero). Project: wagfkuxkrgsencartqtx

ALTER TABLE public.infloww_creator_daily_stats
  ALTER COLUMN fans_with_renew_on DROP NOT NULL;

COMMENT ON COLUMN public.infloww_creator_daily_stats.fans_with_renew_on IS
  'Fans with auto-renew on from GET /v1/creator-report/fans/renew-on. NULL when Infloww omitted the creator/day (distinct from genuine 0).';
