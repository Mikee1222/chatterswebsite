/**
 * Helpers for Airtable linked record fields and text snapshots.
 * Linked fields in API responses are arrays of record IDs; writes expect [recordId].
 * Use snapshot fields for display; use linked ids for relations and writes.
 *
 * IMPORTANT – Airtable formulas: always use double quotes for string literals, e.g. {status} = "active".
 * Do not use single quotes (e.g. {status} = 'active') — they produce invalid formula errors.
 */

/** Normalize Airtable linked field value to array of record IDs. */
export function linkedRecordIds(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v.length > 0);
  }
  if (typeof value === "string" && value.length > 0) return [value];
  return [];
}

/** First linked record ID or null. Use for single-link relations. */
export function firstLinkedId(value: unknown): string | null {
  const ids = linkedRecordIds(value);
  return ids[0] ?? null;
}

/** Text snapshot / display field: string or fallback. */
export function snapshotText(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  if (typeof value === "string") return value.trim() || fallback;
  return fallback;
}

/** Payload for writing a single linked record: Airtable expects array of ids. */
export function toLinkedRecordPayload(recordId: string | null): string[] | undefined {
  if (recordId == null || recordId === "") return undefined;
  return [recordId];
}

/** Escape a string for use inside Airtable double-quoted formula literal ("" for double quotes). */
export function escapeAirtableString(s: string): string {
  return s.replace(/"/g, '""');
}

/** Filter formula: linked field contains given record id. Uses double quotes (valid Airtable syntax). */
export function formulaLinkedContains(fieldName: string, recordId: string): string {
  const escaped = escapeAirtableString(recordId);
  return `FIND("${escaped}", {${fieldName}} & "") > 0`;
}

/** Filter formula: linked field equals single record id. Uses double quotes (valid Airtable syntax). */
export function formulaLinkedEquals(fieldName: string, recordId: string): string {
  const escaped = escapeAirtableString(recordId);
  return `{${fieldName}} = "${escaped}"`;
}
