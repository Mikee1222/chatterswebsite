-- Unique (review_date, manager_name) so each supervisor can have one daily review per day.
-- Race guard for concurrent createDailyReview; app also filters by manager in getDailyReviewByDate.
CREATE UNIQUE INDEX IF NOT EXISTS marketing_daily_reviews_review_date_manager_name_uidx
  ON public.marketing_daily_reviews (review_date, manager_name);
