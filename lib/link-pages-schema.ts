/**
 * Schema contract for Link-in-Bio Airtable tables.
 */

export const LINK_PAGES_TABLE = "link_pages" as const;
export const LINK_PAGE_BLOCKS_TABLE = "link_page_blocks" as const;
export const LINK_PAGE_ANALYTICS_TABLE = "link_page_analytics" as const;
export const LINK_AB_RESULTS_TABLE = "link_ab_results" as const;

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
  verified: "verified",
  ab_test_enabled: "ab_test_enabled",
  ab_variant_id: "ab_variant_id",
  ab_test_name: "ab_test_name",
  ab_winner: "ab_winner",
  ab_started_at: "ab_started_at",
  meta_pixel_id: "meta_pixel_id",
  tiktok_pixel_id: "tiktok_pixel_id",
  cookie_notice_enabled: "cookie_notice_enabled",
  cookie_notice_text: "cookie_notice_text",
  created_at: "created_at",
  updated_at: "updated_at",
} as const;

export const LINK_AB_RESULT_FIELDS = {
  event_id: "event_id",
  page_id: "page_id",
  variant: "variant",
  event_type: "event_type",
  session_id: "session_id",
  block_id: "block_id",
  timestamp: "timestamp",
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
  platform: "platform",
  custom_button_color: "custom_button_color",
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
export const LINK_PAGE_BACKGROUND_TYPES = [
  "color",
  "gradient",
  "gradient_preset",
  "pattern",
  "image",
  "animated",
] as const;
export const LINK_PAGE_THEMES = ["dark", "light", "minimal", "neon", "gold"] as const;
export const LINK_PAGE_FONTS = [
  "modern",
  "inter",
  "poppins",
  "raleway",
  "montserrat",
  "playfair",
  "dancing",
  "bebas",
  "nunito",
  "lato",
  "oswald",
  "elegant",
  "bold",
  "minimal",
] as const;
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
export const LINK_PAGE_AB_WINNERS = ["none", "a", "b"] as const;
export const LINK_PAGE_AB_VARIANTS = ["a", "b"] as const;
export const LINK_PAGE_AB_EVENT_TYPES = ["view", "click"] as const;

/** Allowed social platforms for link-page presets and icon pickers (no adult platforms). */
export const LINK_PAGE_PLATFORMS = [
  { id: "instagram", label: "Instagram", icon: "📸", urlPrefix: "https://instagram.com/" },
  { id: "tiktok", label: "TikTok", icon: "🎵", urlPrefix: "https://tiktok.com/@" },
  { id: "telegram", label: "Telegram", icon: "💬", urlPrefix: "https://t.me/" },
  { id: "twitter", label: "X / Twitter", icon: "𝕏", urlPrefix: "https://x.com/" },
  { id: "facebook", label: "Facebook", icon: "📘", urlPrefix: "https://facebook.com/" },
  { id: "youtube", label: "YouTube", icon: "▶", urlPrefix: "https://youtube.com/" },
  { id: "snapchat", label: "Snapchat", icon: "👻", urlPrefix: "https://snapchat.com/add/" },
  { id: "pinterest", label: "Pinterest", icon: "📌", urlPrefix: "https://pinterest.com/" },
  { id: "discord", label: "Discord", icon: "🎮", urlPrefix: "https://discord.gg/" },
  { id: "whatsapp", label: "WhatsApp", icon: "📱", urlPrefix: "https://wa.me/" },
  { id: "custom", label: "Custom", icon: "🔗", urlPrefix: "" },
] as const;

export type LinkPagePlatformId = (typeof LINK_PAGE_PLATFORMS)[number]["id"];
