-- Speed up getUnreadCount (.is("read_at", null) per user_id).
-- Table has ~110k rows / ~94k unread; hot users exceed 10k unread each.
-- Existing idx_notifications_user_read (user_id, is_read) only matches user_id
-- for the read_at IS NULL filter (EXPLAIN: Filter on read_at after bitmap scan).
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_read_at
  ON public.notifications (user_id)
  WHERE read_at IS NULL;
