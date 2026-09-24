/** Stored iCloud upload folder name(s) — JSON array, newline list, or a single legacy URL/name. */

export const UPLOAD_FOLDER_NAME_HINT =
  "Enter the iCloud folder name — not a URL. Path: Video To Upload → Year → Month → Week → Day → Main or Secondary → Trial or Grid.";

export const UPLOAD_FOLDER_NAME_PLACEHOLDER =
  "e.g. 2026 · September · Week 4 · 24 · Main Account · Trial";

function cleanName(value: unknown): string {
  return String(value ?? "").trim();
}

/** Parse stored upload folder value into display/input rows. */
export function parseUploadFolderNames(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map(cleanName).filter(Boolean);
  }
  const text = String(raw).trim();
  if (!text) return [];
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map(cleanName).filter(Boolean);
      }
    } catch {
      // treat the raw string as a single folder name
    }
  }
  if (/[\r\n]/.test(text)) {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return [text];
}

/** Persist folder names in the existing text column. */
export function serializeUploadFolderNames(names: string[]): string {
  const cleaned = names.map((name) => name.trim()).filter(Boolean);
  if (cleaned.length === 0) return "";
  if (cleaned.length === 1) return cleaned[0];
  return JSON.stringify(cleaned);
}

export function folderNamesFromRequestBody(
  body: Record<string, unknown>,
  arrayKey: string,
  legacyKey: string,
): string[] {
  if (arrayKey in body) {
    return parseUploadFolderNames(body[arrayKey]);
  }
  return parseUploadFolderNames(body[legacyKey]);
}
