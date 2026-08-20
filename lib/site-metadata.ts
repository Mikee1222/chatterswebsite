import type { Metadata } from "next";

/** Canonical public origin for Open Graph / Twitter absolute URLs. */
export const SITE_ORIGIN =
  (process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    "https://www.gunzoteam.com");

export const SITE_NAME = "Gunzo Partner";

export const SITE_TITLE = "Gunzo Agency";

/** Professional English description for social / SEO previews. */
export const SITE_DESCRIPTION =
  "Gunzo Agency — OnlyFans creator management, chatting operations, and partner tools for models, agencies, and talent teams.";

/** Shared 1200×630 branded preview (logo + wordmark). */
export const OG_IMAGE_PATH = "/og-image.png";

export const OG_IMAGE = {
  url: OG_IMAGE_PATH,
  width: 1200,
  height: 630,
  alt: "Gunzo Agency",
} as const;

export function absoluteUrl(path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalized}`;
}

/** Trim intro/description text for meta description (plain text, ~155 chars). */
export function trimMetaDescription(
  text: string | null | undefined,
  maxLen = 155
): string | undefined {
  if (!text) return undefined;
  const plain = text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return undefined;
  if (plain.length <= maxLen) return plain;
  const cut = plain.slice(0, maxLen - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function buildOpenGraph(opts: {
  title: string;
  description: string;
  url: string;
  type?: "website" | "article" | "profile";
}): NonNullable<Metadata["openGraph"]> {
  return {
    title: opts.title,
    description: opts.description,
    url: opts.url,
    siteName: SITE_NAME,
    type: opts.type ?? "website",
    images: [OG_IMAGE],
  };
}

export function buildTwitterCard(opts: {
  title: string;
  description: string;
}): NonNullable<Metadata["twitter"]> {
  return {
    card: "summary_large_image",
    title: opts.title,
    description: opts.description,
    images: [OG_IMAGE_PATH],
  };
}
