/**
 * Dual-run data backend flag (Phase 3).
 *
 * Default: "airtable" — production must keep this until cutover.
 * Set DATA_BACKEND=supabase only in local/staging after migrated slices are verified.
 */

export type DataBackend = "airtable" | "supabase";

export function getDataBackend(): DataBackend {
  const raw = (process.env.DATA_BACKEND ?? "airtable").trim().toLowerCase();
  if (raw === "supabase") return "supabase";
  return "airtable";
}

export function isSupabaseBackend(): boolean {
  return getDataBackend() === "supabase";
}

export function isAirtableBackend(): boolean {
  return getDataBackend() === "airtable";
}
