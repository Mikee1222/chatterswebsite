/**
 * Dual-backend whale_activity reader for whale detail pages.
 */
import { isSupabaseBackend } from "@/lib/data-backend";
import { listAllRecords } from "@/lib/airtable-server";
import type { WhaleActivityRow } from "./whale-activity-supabase";

const TABLE = "whale_activity";

export type { WhaleActivityRow };

export async function listWhaleActivityByWhaleId(
  whaleId: string,
  limit = 30
): Promise<WhaleActivityRow[]> {
  if (isSupabaseBackend()) {
    return (await import("./whale-activity-supabase")).listWhaleActivityByWhaleId(whaleId, limit);
  }
  const id = whaleId.trim();
  if (!id) return [];
  const activityRaw = await listAllRecords<Record<string, unknown>>(TABLE, {
    filterByFormula: `{whale_id} = '${id.replace(/'/g, "\\'")}'`,
  }).catch(() => []);
  return activityRaw
    .map((r) => ({ id: r.id, ...r.fields } as WhaleActivityRow))
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
    .slice(0, limit);
}
