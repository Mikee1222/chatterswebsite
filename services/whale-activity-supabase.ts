/**
 * Supabase backend for whale_activity reads (whale detail pages).
 */
import { publicId, sbSelectAll, type SbRow } from "@/lib/supabase-data";

const TABLE = "whale_activity";

type Row = SbRow & {
  activity_id?: string | null;
  whale_id?: string | null;
  whale_username?: string | null;
  chatter_id?: string | null;
  chatter_name?: string | null;
  action_type?: string | null;
  summary?: string | null;
  details?: string | null;
  created_at?: string | null;
};

export type WhaleActivityRow = Record<string, unknown> & { id: string };

export async function listWhaleActivityByWhaleId(
  whaleId: string,
  limit = 30
): Promise<WhaleActivityRow[]> {
  const id = whaleId.trim();
  if (!id) return [];
  const rows = await sbSelectAll<Row>(TABLE);
  return rows
    .filter((r) => (r.whale_id ?? "").trim() === id)
    .map((r) => ({
      id: publicId(r),
      activity_id: r.activity_id ?? "",
      whale_id: r.whale_id ?? "",
      whale_username: r.whale_username ?? "",
      chatter_id: r.chatter_id ?? "",
      chatter_name: r.chatter_name ?? "",
      action_type: r.action_type ?? "",
      summary: r.summary ?? "",
      details: r.details ?? "",
      created_at: r.created_at ?? null,
    }))
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
    .slice(0, limit);
}
