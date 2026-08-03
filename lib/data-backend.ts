/**
 * Dual-run data backend flag (Phase 3).
 *
 * Default: "airtable" — production must keep this until cutover.
 * Set DATA_BACKEND=supabase only in Preview/staging after migrated slices are verified.
 *
 * Client detection: do NOT rely on NEXT_PUBLIC_DATA_BACKEND alone (easy to mis-set on
 * Production builds). Prefer server-injected DataBackendProvider from getDataBackend().
 * NEXT_PUBLIC_DATA_BACKEND is an optional mirror for edge cases / scripts.
 */

export type DataBackend = "airtable" | "supabase";

function parseBackend(raw: string | undefined | null): DataBackend {
  const v = (raw ?? "airtable").trim().toLowerCase();
  if (v === "supabase") return "supabase";
  return "airtable";
}

/** Server (and build-time) source of truth. Never set supabase on Production. */
export function getDataBackend(): DataBackend {
  return parseBackend(process.env.DATA_BACKEND);
}

export function isSupabaseBackend(): boolean {
  return getDataBackend() === "supabase";
}

export function isAirtableBackend(): boolean {
  return getDataBackend() === "airtable";
}

/**
 * Optional public mirror for client bundles. Prefer DataBackendProvider.
 * Production must leave this unset or "airtable".
 */
export function getPublicDataBackendHint(): DataBackend {
  return parseBackend(process.env.NEXT_PUBLIC_DATA_BACKEND);
}
