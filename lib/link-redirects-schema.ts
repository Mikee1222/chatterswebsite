/**
 * Schema contract for link page redirect short URLs (Airtable).
 */

export const LINK_REDIRECTS_TABLE = "link_redirects" as const;

export const LINK_REDIRECT_FIELDS = {
  redirect_id: "redirect_id",
  page_id: "page_id",
  slug: "slug",
  destination_url: "destination_url",
  label: "label",
  click_count: "click_count",
  is_active: "is_active",
  created_at: "created_at",
  updated_at: "updated_at",
} as const;

/** Build the public short URL for a redirect (never exposes destination). */
export function buildRedirectPublicUrl(
  page: { slug: string; custom_domain?: string },
  redirectSlug: string,
  origin = "https://gunzoteam.com"
): string {
  const slug = redirectSlug.trim();
  const domain = page.custom_domain?.trim().toLowerCase().replace(/^www\./, "");
  if (domain) {
    return `https://${domain}/r/${encodeURIComponent(slug)}`;
  }
  return `${origin.replace(/\/$/, "")}/l/${encodeURIComponent(page.slug)}/${encodeURIComponent(slug)}`;
}
