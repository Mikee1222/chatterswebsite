/**
 * Pure helpers for whales list filtering (admin table).
 * No "use server" – safe to use from services and RSC without server-action constraints.
 */

/** Filters for server-side whales list (admin). */
export type WhalesListFilters = {
  chatterId?: string;
  modelId?: string;
  relationshipStatus?: string;
  status?: string;
  usernameSearch?: string;
};

export const WHALES_DEFAULT_PAGE_SIZE = 50;

/**
 * Build Airtable filterByFormula for whales table.
 * Uses only fields that work reliably in Airtable: status, relationship_status, username.
 * Linked fields (assigned_chatter, assigned_model) are filtered in-memory after fetch.
 */
export function buildWhalesFilterFormula(filters: WhalesListFilters): string | undefined {
  const parts: string[] = [];
  if (filters.relationshipStatus !== undefined && filters.relationshipStatus !== "") {
    const v = String(filters.relationshipStatus).replace(/"/g, '""');
    parts.push(`{relationship_status} = "${v}"`);
  }
  if (filters.status?.trim()) {
    const v = filters.status.trim().replace(/"/g, '""');
    parts.push(`{status} = "${v}"`);
  }
  if (filters.usernameSearch?.trim()) {
    const q = filters.usernameSearch.trim().toLowerCase().replace(/"/g, '""').slice(0, 100);
    parts.push(`FIND("${q}", LOWER(IF({username}, {username}, "")))`);
  }
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return "AND(" + parts.join(", ") + ")";
}
