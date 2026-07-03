/** What was reported for the account: issue types or a VA-reported restriction lift. */
export type ShadowbanReportType = "shadowbanned" | "banned" | "lifted";

const LIFTED_NOTES_RE = /^\s*\[restriction lifted\]/i;

/**
 * Resolve the report type from an Airtable shadowban_reports row.
 * The submit route encodes the type in the notes prefix ("[Ban reported]" / "[Shadowban reported]" / "[Restriction lifted]"),
 * and (forward-compatible) may also set a dedicated `report_type` field.
 */
export function deriveShadowbanReportType(fields: {
  report_type?: unknown;
  notes?: unknown;
}): ShadowbanReportType {
  const rt = typeof fields.report_type === "string" ? fields.report_type.trim().toLowerCase() : "";
  if (rt === "lifted") return "lifted";
  if (rt === "banned") return "banned";
  if (rt === "shadowbanned") return "shadowbanned";
  const notes = typeof fields.notes === "string" ? fields.notes : "";
  if (LIFTED_NOTES_RE.test(notes)) return "lifted";
  return /^\s*\[ban reported\]/i.test(notes) ? "banned" : "shadowbanned";
}

export function formatLiftedReportNotes(rawNotes: string): string {
  const trimmed = rawNotes.trim();
  return trimmed ? `[Restriction lifted] ${trimmed}` : "[Restriction lifted]";
}

const REPORT_NOTES_PREFIX_RE = /^\s*\[(ban reported|shadowban reported|restriction lifted)\]\s*/i;

/** User-facing notes with the submit-route type prefix stripped. */
export function stripShadowbanReportNotesPrefix(notes: string): string {
  return notes.replace(REPORT_NOTES_PREFIX_RE, "").trim();
}
