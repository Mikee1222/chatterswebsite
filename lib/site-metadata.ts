import type { Metadata } from "next";

/** Canonical public origin for Open Graph / Twitter absolute URLs. */
export const SITE_ORIGIN =
  (process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    "https://www.gunzoteam.com");

export const SITE_NAME = "Gunzo Agency";

export const SITE_TITLE = "Gunzo Agency";

/** Professional English description for social / SEO previews. */
export const SITE_DESCRIPTION =
  "Gunzo Agency — Premium OnlyFans management and chatting services. We help creators grow their presence, maximize revenue, and build lasting fan relationships through expert chat teams and dedicated account management.";

/**
 * Internal dashboard / PWA copy only — never use on public /apply pages.
 * Kept in Greek for the staff-facing product surface.
 */
export const INTERNAL_SITE_DESCRIPTION =
  "Gunzo Agency — Εσωτερική πλατφόρμα για chatters, VAs, models και admins.";

/** Default English careers/SEO description for public application pages. */
export const APPLY_SITE_DESCRIPTION =
  "Apply to join Gunzo Agency. The application takes about 15 minutes and includes a short screening.";

/** Shared 1200×630 branded preview (logo + wordmark). */
export const OG_IMAGE_PATH = "/og-image.png";

/** Dashboard-only PWA manifest (internal Greek description). */
export const DASHBOARD_MANIFEST_PATH = "/manifest-dashboard.json";

/** Known public apply forms → branded English title + invite description. */
const APPLY_FORM_META: Record<string, { title: string; description: string }> = {
  "new-va-application": {
    title: "VA Application — Gunzo Agency",
    description:
      "Apply to join Gunzo Agency as a Virtual Assistant. Takes about 15 minutes — short screening plus the application form.",
  },
  "new-chatters-apply-form": {
    title: "Chatter Application — Gunzo Agency",
    description:
      "Apply to join Gunzo Agency as a Chatter. Takes about 15 minutes — short screening plus the application form.",
  },
};

function humanizeApplyFormTitle(formTitle: string): string {
  const cleaned = formTitle
    .replace(/^new\s+/i, "")
    .replace(/\s+apply\s+form$/i, "")
    .replace(/\s+application$/i, " Application")
    .trim();
  if (!cleaned) return "Application";
  if (/application$/i.test(cleaned)) return cleaned;
  return `${cleaned} Application`;
}

/** Branded English head tags for `/apply/[slug]` (never inherits form body or Greek internal copy). */
export function resolveApplyFormMeta(opts: {
  slug: string;
  formTitle?: string | null;
}): { title: string; description: string } {
  const known = APPLY_FORM_META[opts.slug];
  if (known) return known;
  const label = opts.formTitle?.trim()
    ? humanizeApplyFormTitle(opts.formTitle.trim())
    : "Application";
  return {
    title: `${label} — ${SITE_TITLE}`,
    description: APPLY_SITE_DESCRIPTION,
  };
}

export function buildApplyPageMetadata(opts: {
  slug: string;
  formTitle?: string | null;
}): Metadata {
  const { title, description } = resolveApplyFormMeta(opts);
  const pageUrl = absoluteUrl(`/apply/${encodeURIComponent(opts.slug)}`);
  return {
    title: { absolute: title },
    description,
    applicationName: SITE_NAME,
    alternates: { canonical: pageUrl },
    // Clear parent PWA/internal metadata so candidate pages stay public-branded.
    manifest: null,
    appleWebApp: null,
    openGraph: buildOpenGraph({
      title,
      description,
      url: pageUrl,
    }),
    twitter: buildTwitterCard({ title, description }),
  };
}

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
