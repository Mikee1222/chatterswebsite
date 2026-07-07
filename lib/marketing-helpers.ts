/** Parse newline-separated phone file links from Airtable (max 5). */
export function parsePhoneFileLinks(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);
}

/** Serialize phone file links for Airtable storage (max 5, newline-separated). */
export function joinPhoneFileLinks(links: string[] | undefined): string {
  if (!links?.length) return "";
  return links
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5)
    .join("\n");
}
