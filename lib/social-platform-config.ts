/**
 * Shared social-platform presentation config (colors, glow, legacy glyph map).
 * React icon components live in `components/social-platform-icon.tsx`.
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

/**
 * @deprecated Use `SocialPlatformIcon` from `@/components/social-platform-icon` instead.
 * Kept empty so legacy string lookups do not render emoji.
 */
export const PLATFORM_ICONS: Record<string, string> = {
  Instagram: "",
  Facebook: "",
  TikTok: "",
  Twitter: "",
  YouTube: "",
  Snapchat: "",
  Telegram: "",
  GetMyLinks: "",
  Other: "",
};

/** @deprecated Use `SocialPlatformIcon` instead. */
export function getPlatformIcon(platform: string | null | undefined): string {
  const key = (platform ?? "").trim();
  return PLATFORM_ICONS[key] ?? "";
}

/** Branded ambient glow per platform (accent on top of getSocialColor border fills). */
export function getPlatformAccentGlow(platform: string): string {
  const p = platform.trim().toLowerCase();
  if (p === "instagram") {
    return "shadow-[0_0_20px_-6px_rgba(225,48,108,0.55),0_0_12px_-4px_rgba(253,29,29,0.35),0_0_8px_-4px_rgba(252,175,69,0.3)]";
  }
  if (p === "tiktok") {
    return "shadow-[0_0_18px_-5px_rgba(37,244,238,0.45),0_0_14px_-5px_rgba(254,44,85,0.4)]";
  }
  if (p === "youtube") {
    return "shadow-[0_0_16px_-5px_rgba(255,0,0,0.45)]";
  }
  if (p === "twitter" || p === "x") {
    return "shadow-[0_0_16px_-5px_rgba(29,161,242,0.45)]";
  }
  if (p === "facebook") {
    return "shadow-[0_0_16px_-5px_rgba(24,119,242,0.45)]";
  }
  if (p === "snapchat") {
    return "shadow-[0_0_16px_-5px_rgba(255,252,0,0.35)]";
  }
  if (p === "telegram") {
    return "shadow-[0_0_16px_-5px_rgba(34,158,217,0.45)]";
  }
  if (p === "getmylinks") {
    return "shadow-[0_0_16px_-5px_rgba(147,51,234,0.45)]";
  }
  const color = getSocialColor(platform);
  return `shadow-[0_0_16px_-6px_${color}66]`;
}
