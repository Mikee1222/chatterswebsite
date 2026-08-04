/**
 * Supabase backend for whale_activity reads (whale detail pages).
 */
import { publicId, sbSelectWhere, type SbRow } from "@/lib/supabase-data";

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
  const rows = await sbSelectWhere<Row>(TABLE, (q) =>
    q.eq("whale_id", id).order("created_at", { ascending: false })
  );
  return rows.slice(0, limit).map((r) => ({
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
  }));
}
