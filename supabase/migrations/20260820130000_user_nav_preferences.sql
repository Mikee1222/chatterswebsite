-- Per-user sidebar navigation preferences (pinned items, collapsed/hidden sections).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS nav_preferences jsonb;

COMMENT ON COLUMN public.users.nav_preferences IS
  'JSON: { pinned_hrefs: string[], collapsed_sections: string[], hidden_sections: string[] }';
