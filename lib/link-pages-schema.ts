/**
 * Schema contract for Link-in-Bio Airtable tables.
 */

export const LINK_PAGES_TABLE = "link_pages" as const;
export const LINK_PAGE_BLOCKS_TABLE = "link_page_blocks" as const;
export const LINK_PAGE_ANALYTICS_TABLE = "link_page_analytics" as const;

export const LINK_PAGE_FIELDS = {
  page_id: "page_id",
  model_id: "model_id",
  slug: "slug",
  status: "status",
  title: "title",
  bio: "bio",
  profile_photo_url: "profile_photo_url",
  background_type: "background_type",
  background_value: "background_value",
  theme: "theme",
  primary_color: "primary_color",
  accent_color: "accent_color",
  font: "font",
  custom_domain: "custom_domain",
  show_powered_by: "show_powered_by",
  meta_description: "meta_description",
  created_at: "created_at",
  updated_at: "updated_at",
} as const;

export const LINK_PAGE_BLOCK_FIELDS = {
  block_id: "block_id",
  page_id: "page_id",
  block_type: "block_type",
  sort_order: "sort_order",
  is_visible: "is_visible",
  label: "label",
  url: "url",
  icon: "icon",
  sublabel: "sublabel",
  style: "style",
  photo_urls: "photo_urls",
  countdown_target: "countdown_target",
  heading_text: "heading_text",
  created_at: "created_at",
  updated_at: "updated_at",
} as const;

export const LINK_PAGE_ANALYTICS_FIELDS = {
  event_id: "event_id",
  page_id: "page_id",
  block_id: "block_id",
  event_type: "event_type",
  ip_address: "ip_address",
  country: "country",
  city: "city",
  region: "region",
  device_type: "device_type",
  browser: "browser",
  os: "os",
  referrer: "referrer",
  user_agent: "user_agent",
  session_id: "session_id",
  timestamp: "timestamp",
  utm_source: "utm_source",
  utm_medium: "utm_medium",
  utm_campaign: "utm_campaign",
} as const;

export const LINK_PAGE_STATUSES = ["draft", "published", "archived"] as const;
export const LINK_PAGE_BACKGROUND_TYPES = ["color", "gradient", "image"] as const;
export const LINK_PAGE_THEMES = ["dark", "light", "minimal", "neon", "gold"] as const;
export const LINK_PAGE_FONTS = ["modern", "elegant", "bold", "minimal"] as const;
export const LINK_PAGE_BLOCK_TYPES = [
  "link",
  "bio_text",
  "photo_grid",
  "countdown",
  "social_bar",
  "spacer",
  "heading",
] as const;
export const LINK_PAGE_BLOCK_STYLES = ["default", "prominent", "subtle", "pill", "card"] as const;
export const LINK_PAGE_ANALYTICS_EVENT_TYPES = ["page_view", "link_click"] as const;
export const LINK_PAGE_DEVICE_TYPES = ["mobile", "desktop", "tablet"] as const;
