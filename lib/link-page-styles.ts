import { LINK_PAGE_PLATFORMS, type LinkPagePlatformId } from "@/lib/link-pages-schema";
import type { LinkPageBlockRecord, LinkPageBlockStyle, LinkPageWithBlocks } from "@/types";

export type PlatformBranding = {
  id: LinkPagePlatformId;
  label: string;
  pillColor: string;
  prominentBg: string;
  accentColor: string;
  textColor: string;
  borderColor: string;
  svg: string;
};

const PLATFORM_IDS = new Set(LINK_PAGE_PLATFORMS.map((p) => p.id));

const SVG = {
  telegram: `<svg viewBox="0 0 24 24" fill="white" width="20" height="20" aria-hidden="true"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.820 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>`,
  instagram: `<svg viewBox="0 0 24 24" fill="white" width="20" height="20" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>`,
  tiktok: `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#25F4EE" d="M12.5 3v9.5a3.5 3.5 0 1 1-2.45-3.35V8.1a6.5 6.5 0 1 0 5.95 6.4V9.5c1 .65 2.2 1 3.5 1V7.5c-1.55 0-2.95-.65-3.95-1.7V3h-2.5z"/><path fill="#FE2C55" d="M14.5 7.5V9.5c1 .65 2.2 1 3.5 1V7.5c-1.55 0-2.95-.65-3.95-1.7H14.5v1.7z"/><path fill="white" d="M10.05 11.65a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>`,
  twitter: `<svg viewBox="0 0 24 24" fill="white" width="18" height="18" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
  facebook: `<svg viewBox="0 0 24 24" fill="white" width="20" height="20" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
  snapchat: `<svg viewBox="0 0 24 24" fill="#000" width="20" height="20" aria-hidden="true"><path d="M12.017 0C7.396 0 4.317 3.366 4.317 7.276c0 1.925.746 3.675 1.962 4.978-.006.033-.012.066-.018.1-.303 1.778-1.033 3.146-1.754 4.242-.36.548-.721 1.033-1.033 1.457-.303.412-.548.766-.721 1.033-.174.267-.267.457-.267.548 0 .091.033.151.094.181.061.03.151.045.267.045.303 0 .766-.121 1.366-.363.6-.242 1.327-.575 2.145-.997.818-.421 1.724-.903 2.69-1.417.966.514 1.872.996 2.69 1.417.818.422 1.545.755 2.145.997.6.242 1.063.363 1.366.363.116 0 .206-.015.267-.045.061-.03.094-.09.094-.181 0-.091-.093-.281-.267-.548-.173-.267-.418-.621-.721-1.033-.312-.424-.673-.909-1.033-1.457-.721-1.096-1.451-2.464-1.754-4.242-.006-.034-.012-.067-.018-.1 1.216-1.303 1.962-3.053 1.962-4.978C19.683 3.366 16.638 0 12.017 0z"/></svg>`,
  youtube: `<svg viewBox="0 0 24 24" fill="white" width="20" height="20" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
  whatsapp: `<svg viewBox="0 0 24 24" fill="white" width="20" height="20" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>`,
  discord: `<svg viewBox="0 0 24 24" fill="white" width="20" height="20" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`,
  pinterest: `<svg viewBox="0 0 24 24" fill="white" width="20" height="20" aria-hidden="true"><path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.403.042-3.441.219-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/></svg>`,
  custom: `<span style="font-size:18px;line-height:1" aria-hidden="true">🔗</span>`,
};

export const PLATFORM_BRANDING: Record<LinkPagePlatformId, PlatformBranding> = {
  telegram: {
    id: "telegram",
    label: "Telegram",
    pillColor: "#229ED9",
    prominentBg: "linear-gradient(135deg, #2AABEE, #229ED9)",
    accentColor: "#229ED9",
    textColor: "#ffffff",
    borderColor: "rgba(34,158,217,0.45)",
    svg: SVG.telegram,
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    pillColor: "#E1306C",
    prominentBg: "linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
    accentColor: "#E1306C",
    textColor: "#ffffff",
    borderColor: "rgba(225,48,108,0.45)",
    svg: SVG.instagram,
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    pillColor: "#161823",
    prominentBg: "linear-gradient(135deg, #010101, #161823)",
    accentColor: "#ffffff",
    textColor: "#ffffff",
    borderColor: "rgba(255,255,255,0.2)",
    svg: SVG.tiktok,
  },
  twitter: {
    id: "twitter",
    label: "X / Twitter",
    pillColor: "#000000",
    prominentBg: "#000000",
    accentColor: "#ffffff",
    textColor: "#ffffff",
    borderColor: "#333333",
    svg: SVG.twitter,
  },
  facebook: {
    id: "facebook",
    label: "Facebook",
    pillColor: "#1877F2",
    prominentBg: "linear-gradient(135deg, #1877F2, #0C5FD6)",
    accentColor: "#1877F2",
    textColor: "#ffffff",
    borderColor: "rgba(24,119,242,0.45)",
    svg: SVG.facebook,
  },
  youtube: {
    id: "youtube",
    label: "YouTube",
    pillColor: "#FF0000",
    prominentBg: "linear-gradient(135deg, #FF0000, #CC0000)",
    accentColor: "#FF0000",
    textColor: "#ffffff",
    borderColor: "rgba(255,0,0,0.45)",
    svg: SVG.youtube,
  },
  snapchat: {
    id: "snapchat",
    label: "Snapchat",
    pillColor: "#FFFC00",
    prominentBg: "#FFFC00",
    accentColor: "#FFFC00",
    textColor: "#000000",
    borderColor: "rgba(255,252,0,0.55)",
    svg: SVG.snapchat,
  },
  pinterest: {
    id: "pinterest",
    label: "Pinterest",
    pillColor: "#E60023",
    prominentBg: "linear-gradient(135deg, #E60023, #B60019)",
    accentColor: "#E60023",
    textColor: "#ffffff",
    borderColor: "rgba(230,0,35,0.45)",
    svg: SVG.pinterest,
  },
  discord: {
    id: "discord",
    label: "Discord",
    pillColor: "#5865F2",
    prominentBg: "linear-gradient(135deg, #5865F2, #4752C4)",
    accentColor: "#5865F2",
    textColor: "#ffffff",
    borderColor: "rgba(88,101,242,0.45)",
    svg: SVG.discord,
  },
  whatsapp: {
    id: "whatsapp",
    label: "WhatsApp",
    pillColor: "#25D366",
    prominentBg: "linear-gradient(135deg, #25D366, #128C7E)",
    accentColor: "#25D366",
    textColor: "#ffffff",
    borderColor: "rgba(37,211,102,0.45)",
    svg: SVG.whatsapp,
  },
  custom: {
    id: "custom",
    label: "Custom",
    pillColor: "#ec4899",
    prominentBg: "linear-gradient(135deg, #ec4899, #a855f7)",
    accentColor: "#ec4899",
    textColor: "#ffffff",
    borderColor: "rgba(236,72,153,0.45)",
    svg: SVG.custom,
  },
};

const URL_PLATFORM_HINTS: Array<[RegExp, LinkPagePlatformId]> = [
  [/t\.me|telegram/i, "telegram"],
  [/instagram\.com/i, "instagram"],
  [/tiktok\.com/i, "tiktok"],
  [/(x\.com|twitter\.com)/i, "twitter"],
  [/facebook\.com|fb\.com/i, "facebook"],
  [/youtube\.com|youtu\.be/i, "youtube"],
  [/snapchat\.com/i, "snapchat"],
  [/pinterest\.com/i, "pinterest"],
  [/discord\.(gg|com)/i, "discord"],
  [/wa\.me|whatsapp\.com/i, "whatsapp"],
];

function isPlatformId(value: string): value is LinkPagePlatformId {
  return PLATFORM_IDS.has(value as LinkPagePlatformId);
}

/** Resolve platform from block fields (supports legacy emoji icon values). */
export function detectLinkPlatform(block: Pick<LinkPageBlockRecord, "platform" | "icon" | "url">): LinkPagePlatformId {
  const explicit = block.platform?.trim().toLowerCase();
  if (explicit && isPlatformId(explicit)) return explicit;

  const icon = block.icon?.trim();
  if (icon && isPlatformId(icon.toLowerCase())) return icon.toLowerCase() as LinkPagePlatformId;

  if (icon) {
    const byEmoji = LINK_PAGE_PLATFORMS.find((p) => p.icon === icon);
    if (byEmoji) return byEmoji.id;
  }

  const url = block.url?.trim() ?? "";
  for (const [pattern, id] of URL_PLATFORM_HINTS) {
    if (pattern.test(url)) return id;
  }

  return "custom";
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.trim().match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return `rgba(236,72,153,${alpha})`;
  const n = m[1];
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function customIconHtml(block: LinkPageBlockRecord): string {
  const icon = block.icon?.trim();
  if (icon && !isPlatformId(icon.toLowerCase()) && icon !== "custom") {
    return `<span style="font-size:18px;line-height:1" aria-hidden="true">${icon}</span>`;
  }
  return SVG.custom;
}

function brandingForBlock(block: LinkPageBlockRecord, primaryColor: string): PlatformBranding {
  const platform = detectLinkPlatform(block);
  const base = PLATFORM_BRANDING[platform];
  if (platform !== "custom") return base;

  const color = block.custom_button_color?.trim() || primaryColor || "#ec4899";
  return {
    ...base,
    prominentBg: `linear-gradient(135deg, ${color}, ${color}cc)`,
    accentColor: color,
    pillColor: color,
    borderColor: hexToRgba(color, 0.45),
    svg: customIconHtml(block),
  };
}

function styleClasses(style: LinkPageBlockStyle): string {
  const classes = ["link-btn", "block-link"];
  if (style !== "default") classes.push(`style-${style}`);
  return classes.join(" ");
}

function platformButtonExtras(platform: LinkPagePlatformId): string {
  if (platform === "tiktok") return "border:1px solid rgba(255,255,255,0.12);";
  if (platform === "twitter") return "border:1px solid #333;";
  return "";
}

function inlineStyles(
  branding: PlatformBranding,
  style: LinkPageBlockStyle,
  platform: LinkPagePlatformId
): string {
  const branded = `background:${branding.prominentBg};color:${branding.textColor};${platformButtonExtras(platform)}`;
  if (style === "subtle") {
    return `background:transparent;color:var(--text);border:1px solid ${branding.borderColor};`;
  }
  if (style === "prominent" || style === "pill" || style === "card" || style === "default") {
    return branded;
  }
  return branded;
}

/** Platform-specific button styling for preview and public pages. */
export function getPlatformStyles(
  block: LinkPageBlockRecord,
  primaryColor: string,
  style: LinkPageBlockStyle = block.style ?? "default"
): { platform: LinkPagePlatformId; branding: PlatformBranding; inline: string } {
  const platform = detectLinkPlatform(block);
  const branding = brandingForBlock(block, primaryColor);
  return { platform, branding, inline: inlineStyles(branding, style, platform) };
}

const ARROW_SVG = `<svg class="link-arrow" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>`;

export function verifiedBadgeHtml(): string {
  return `<span class="verified-badge" aria-label="Verified"><svg width="12" height="12" viewBox="0 0 24 24" fill="white" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></span>`;
}

export function renderBrandedLinkHtml(
  block: LinkPageBlockRecord,
  href: string,
  primaryColor: string,
  escapeHtml: (s: string) => string
): string {
  const style = block.style ?? "default";
  const { platform, branding, inline } = getPlatformStyles(block, primaryColor, style);
  const label = block.label || branding.label || block.url || "Link";
  const sublabel = block.sublabel?.trim();
  const classes = styleClasses(style);

  const sublabelHtml = sublabel
    ? `<div class="link-sublabel">${escapeHtml(sublabel)}</div>`
    : "";

  return `<a class="${classes}" href="${escapeHtml(href)}" rel="noopener noreferrer" data-platform="${platform}" style="${inline}">
    <div class="link-icon-wrap">${branding.svg}</div>
    <div class="link-content">
      <div class="link-label">${escapeHtml(label)}</div>
      ${sublabelHtml}
    </div>
    ${ARROW_SVG}
  </a>`;
}

function themeBackgroundDefault(theme: string): string {
  return theme === "light" ? "#f8fafc" : "#0a0a0a";
}

/** Shared theme CSS for public link-in-bio pages */
export function linkPageThemeCss(page: LinkPageWithBlocks): string {
  const primary = page.primary_color || "#ec4899";
  const accent = page.accent_color || "#a855f7";
  const themeBgDefault = themeBackgroundDefault(page.theme);
  const fontFamily =
    page.font === "elegant"
      ? 'Georgia, "Times New Roman", serif'
      : page.font === "bold"
        ? '"Arial Black", Impact, sans-serif'
        : page.font === "minimal"
          ? "system-ui, -apple-system, sans-serif"
          : '"Segoe UI", system-ui, sans-serif';

  const themes: Record<
    string,
    { text: string; muted: string; card: string; border: string; glow: string; overlay: string }
  > = {
    dark: {
      text: "#fafafa",
      muted: "rgba(250,250,250,0.62)",
      card: "rgba(255,255,255,0.07)",
      border: "rgba(255,255,255,0.14)",
      glow: `${primary}33`,
      overlay: "rgba(0,0,0,0.35)",
    },
    light: {
      text: "#0f172a",
      muted: "rgba(15,23,42,0.58)",
      card: "rgba(255,255,255,0.92)",
      border: "rgba(15,23,42,0.1)",
      glow: `${primary}22`,
      overlay: "rgba(255,255,255,0.5)",
    },
    minimal: {
      text: "#f4f4f5",
      muted: "rgba(244,244,245,0.5)",
      card: "transparent",
      border: "rgba(255,255,255,0.18)",
      glow: "transparent",
      overlay: "transparent",
    },
    neon: {
      text: "#ffffff",
      muted: "rgba(255,255,255,0.72)",
      card: "rgba(0,0,0,0.5)",
      border: `${primary}66`,
      glow: `${primary}55`,
      overlay: "rgba(0,0,0,0.45)",
    },
    gold: {
      text: "#fef3c7",
      muted: "rgba(254,243,199,0.68)",
      card: "rgba(0,0,0,0.42)",
      border: "rgba(251,191,36,0.38)",
      glow: "rgba(251,191,36,0.25)",
      overlay: "rgba(0,0,0,0.5)",
    },
  };
  const t = themes[page.theme] ?? themes.dark;

  const bgValue = page.background_value?.trim() ?? "";
  const bgRule =
    page.background_type === "image"
      ? bgValue
        ? `background-color: ${themeBgDefault}; background-image: url(${bgValue}); background-size: cover; background-position: center; background-attachment: fixed;`
        : `background: ${themeBgDefault};`
      : page.background_type === "gradient"
        ? `background: ${bgValue || `linear-gradient(160deg, ${themeBgDefault} 0%, #141414 50%, ${themeBgDefault} 100%)`};`
        : `background: ${bgValue || themeBgDefault};`;

  return `
    .link-page-root {
      --primary: ${primary};
      --accent: ${accent};
      --text: ${t.text};
      --muted: ${t.muted};
      --card: ${t.card};
      --border: ${t.border};
      --glow: ${t.glow};
      --overlay: ${t.overlay};
      font-family: ${fontFamily};
      color: var(--text);
      min-height: 100dvh;
      ${bgRule}
      -webkit-font-smoothing: antialiased;
      position: relative;
      overflow-x: hidden;
    }
    .link-page-root::before {
      content: "";
      position: fixed;
      inset: 0;
      background: var(--overlay);
      pointer-events: none;
      z-index: 0;
    }
    .link-page-root * { box-sizing: border-box; }
    .page-wrap {
      position: relative;
      z-index: 1;
      max-width: 28rem;
      width: 100%;
      margin: 0 auto;
      padding: max(2rem, env(safe-area-inset-top)) 1.25rem max(3rem, env(safe-area-inset-bottom));
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.875rem;
      min-height: 100dvh;
    }
    .preview-banner {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border-radius: 10px;
      background: rgba(251,191,36,0.15);
      border: 1px solid rgba(251,191,36,0.35);
      color: #fde68a;
      font-size: 0.75rem;
      font-weight: 600;
      text-align: center;
      letter-spacing: 0.02em;
    }
    .avatar-wrap {
      position: relative;
      margin-top: 0.5rem;
    }
    .avatar-ring {
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary), var(--accent));
      opacity: 0.85;
      filter: blur(0.5px);
    }
    .avatar {
      position: relative;
      width: 104px;
      height: 104px;
      border-radius: 50%;
      object-fit: cover;
      border: 3px solid rgba(255,255,255,0.9);
      box-shadow: 0 12px 40px var(--glow);
      display: block;
    }
    .avatar-placeholder {
      position: relative;
      width: 104px;
      height: 104px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.25rem;
      font-weight: 700;
      background: linear-gradient(135deg, var(--primary), var(--accent));
      color: #fff;
      border: 3px solid rgba(255,255,255,0.2);
      box-shadow: 0 12px 40px var(--glow);
    }
    .title-row {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 0.35rem;
      max-width: 100%;
    }
    .title {
      font-size: clamp(1.35rem, 5vw, 1.75rem);
      font-weight: 700;
      text-align: center;
      margin: 0.25rem 0 0;
      letter-spacing: -0.02em;
      line-height: 1.2;
    }
    .verified-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #1d9bf0;
      flex-shrink: 0;
    }
    .bio {
      font-size: 0.95rem;
      color: var(--muted);
      text-align: center;
      line-height: 1.55;
      white-space: pre-wrap;
      margin: 0;
      max-width: 22rem;
    }
    .blocks {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 0.7rem;
      margin-top: 0.75rem;
    }
    .block-link {
      display: flex;
      align-items: center;
      gap: 14px;
      width: 100%;
      padding: 16px 20px;
      text-decoration: none;
      border-radius: 16px;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.01em;
      transition: transform 0.15s ease, filter 0.15s ease, box-shadow 0.15s ease;
      position: relative;
      overflow: hidden;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
    .link-btn:hover {
      transform: translateY(-2px);
      filter: brightness(1.1);
    }
    .link-btn:active {
      transform: translateY(0);
      filter: brightness(0.95);
    }
    .block-link.style-pill { border-radius: 999px; }
    .block-link.style-card {
      border-radius: 18px;
      padding: 1.2rem 1.25rem;
    }
    .link-icon-wrap {
      width: 32px;
      height: 32px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .link-content { min-width: 0; flex: 1; text-align: left; }
    .link-label { font-size: 15px; font-weight: 600; line-height: 1.3; }
    .link-sublabel { font-size: 12px; opacity: 0.75; margin-top: 2px; line-height: 1.35; }
    .link-arrow { opacity: 0.6; flex-shrink: 0; }
    .block-heading {
      font-size: 0.8rem;
      font-weight: 700;
      text-align: center;
      padding: 0.35rem 0;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }
    .block-bio {
      font-size: 0.9rem;
      color: var(--muted);
      text-align: center;
      line-height: 1.65;
      white-space: pre-wrap;
      padding: 0.25rem 0.5rem;
    }
    .photo-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.45rem;
      width: 100%;
    }
    .photo-grid img {
      width: 100%;
      aspect-ratio: 1;
      object-fit: cover;
      border-radius: 10px;
      border: 1px solid var(--border);
    }
    .countdown {
      text-align: center;
      padding: 1.1rem 1rem;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      backdrop-filter: blur(8px);
    }
    .countdown-label {
      font-size: 0.82rem;
      color: var(--muted);
      margin-bottom: 0.45rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .countdown-time {
      font-size: 1.65rem;
      font-weight: 700;
      color: var(--primary);
      font-variant-numeric: tabular-nums;
    }
    .social-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
      justify-content: center;
      width: 100%;
    }
    .social-bar a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--card);
      border: 1px solid var(--border);
      color: var(--text);
      text-decoration: none;
      font-size: 1.2rem;
      transition: transform 0.15s ease, border-color 0.15s ease;
    }
    .social-bar a:hover {
      transform: scale(1.06);
      border-color: var(--primary);
    }
    .spacer { height: var(--spacer-h, 1rem); width: 100%; }
    .powered-by {
      margin-top: auto;
      padding-top: 1.5rem;
      font-size: 0.68rem;
      color: var(--muted);
      text-align: center;
      opacity: 0.55;
      letter-spacing: 0.04em;
    }
  `;
}
