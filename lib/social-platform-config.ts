/**
 * Shared social-platform presentation config (colors + icons).
 * Single source of truth imported by all marketing UIs so brand colors and
 * platform icons never drift between VA and admin views.
 */

/** Brand color per social platform. Fallback via getSocialColor(). */
export const SOCIAL_COLORS: Record<string, string> = {
  Instagram: "#E1306C",
  Facebook: "#1877F2",
  TikTok: "#000000",
  Twitter: "#1DA1F2",
  YouTube: "#FF0000",
  Snapchat: "#FFFC00",
  Telegram: "#229ED9",
  GetMyLinks: "#9333EA",
  Other: "#888888",
};

export const SOCIAL_COLOR_FALLBACK = "#888888";

/** Resolve a platform brand color with a safe fallback. */
export function getSocialColor(platform: string | null | undefined): string {
  const key = (platform ?? "").trim();
  return SOCIAL_COLORS[key] ?? SOCIAL_COLOR_FALLBACK;
}

/** Icon glyph per platform (kept for parity with existing UIs; mostly empty by design). */
export const PLATFORM_ICONS: Record<string, string> = {
  Instagram: "",
  Facebook: "",
  TikTok: "",
  Twitter: "",
  YouTube: "▶",
  Snapchat: "",
  Telegram: "",
  GetMyLinks: "",
  Other: "",
};

/** Resolve a platform icon glyph with a safe fallback. */
export function getPlatformIcon(platform: string | null | undefined): string {
  const key = (platform ?? "").trim();
  return PLATFORM_ICONS[key] ?? "";
}
