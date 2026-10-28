/**
 * Assignment identity helpers — match both Airtable-shaped public ids and Postgres UUIDs.
 * Session code uses `airtableUserId ?? id`; stored assignments may use either form.
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";

/** Canonical id used when writing new assignments (prefer Airtable public id). */
export function canonicalAssignmentUserId(user: {
  id?: string | null;
  airtableUserId?: string | null;
}): string {
  return (user.airtableUserId?.trim() || user.id?.trim() || "");
}

/** Unique non-empty identity strings from a session-like object. */
export function sessionAssignmentIds(user: {
  id?: string | null;
  airtableUserId?: string | null;
}): string[] {
  const out = new Set<string>();
  const a = user.airtableUserId?.trim();
  const i = user.id?.trim();
  if (a) out.add(a);
  if (i) out.add(i);
  return [...out];
}

/**
 * Expand a stored/session assignment id to all known equivalents for this user
 * (airtable_id + postgres uuid) so `.in(...)` queries catch historical mismatches.
 */
export async function expandAssignmentIdentityIds(primaryId: string): Promise<string[]> {
  const id = primaryId.trim();
  if (!id) return [];
  const ids = new Set<string>([id]);
  try {
    const sb = getSupabaseServiceClient();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const { data } = isUuid
      ? await sb.from("users").select("id, airtable_id").eq("id", id).maybeSingle()
      : await sb.from("users").select("id, airtable_id").eq("airtable_id", id).maybeSingle();
    if (data) {
      const uuid = String((data as { id?: string }).id ?? "").trim();
      const air = String((data as { airtable_id?: string | null }).airtable_id ?? "").trim();
      if (uuid) ids.add(uuid);
      if (air) ids.add(air);
    }
  } catch {
    // Best-effort expansion; callers still match the primary id.
  }
  return [...ids];
}

/** True when stored assignment id matches any of the viewer's identity forms. */
export function assignmentIdMatches(
  storedId: string | null | undefined,
  viewerIds: string[],
): boolean {
  const s = String(storedId ?? "").trim();
  if (!s || viewerIds.length === 0) return false;
  return viewerIds.includes(s);
}
