/** What was reported for the account: a shadowban (limited reach) or a full ban. */
export type ShadowbanReportType = "shadowbanned" | "banned";

/**
 * Resolve the report type from an Airtable shadowban_reports row.
 * The submit route encodes the type in the notes prefix ("[Ban reported]" / "[Shadowban reported]"),
 * and (forward-compatible) may also set a dedicated `report_type` field.
 */
export function deriveShadowbanReportType(fields: {
  report_type?: unknown;
  notes?: unknown;
}): ShadowbanReportType {
  const rt = typeof fields.report_type === "string" ? fields.report_type.trim().toLowerCase() : "";
  if (rt === "banned") return "banned";
  if (rt === "shadowbanned") return "shadowbanned";
  const notes = typeof fields.notes === "string" ? fields.notes : "";
  return /^\s*\[ban reported\]/i.test(notes) ? "banned" : "shadowbanned";
}
