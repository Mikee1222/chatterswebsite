/**
 * Supabase persistence for daily_review_flag_informed.
 */
import { publicId, sbSelectWhere, type SbRow } from "@/lib/supabase-data";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { toReviewDateKey } from "@/lib/marketing-reviews-helpers";
import type {
  DailyReviewFlagInformed,
  UpsertDailyReviewFlagInformedInput,
} from "./daily-review-flag-informed";

const TABLE = "daily_review_flag_informed";

type Row = SbRow & {
  review_date?: string | null;
  va_id?: string | null;
  va_name?: string | null;
  informed_by?: string | null;
  informed_by_name?: string | null;
  informed_at?: string | null;
};

function mapRow(row: Row): DailyReviewFlagInformed {
  return {
    id: publicId(row),
    review_date: String(row.review_date ?? "").slice(0, 10),
    va_id: String(row.va_id ?? ""),
    va_name: String(row.va_name ?? ""),
    informed_by: String(row.informed_by ?? ""),
    informed_by_name: String(row.informed_by_name ?? ""),
    informed_at: row.informed_at ?? "",
  };
}

export async function listFlagInformedForDate(
  reviewDate: string,
): Promise<DailyReviewFlagInformed[]> {
  const date = toReviewDateKey(reviewDate);
  if (!date) return [];
  const rows = await sbSelectWhere<Row>(TABLE, (q) =>
    q.eq("review_date", date).order("informed_at", { ascending: false }),
  );
  return rows.map(mapRow);
}

export async function listFlagInformedForDates(
  reviewDates: string[],
): Promise<DailyReviewFlagInformed[]> {
  const dates = [
    ...new Set(reviewDates.map((d) => toReviewDateKey(d)).filter((d): d is string => Boolean(d))),
  ];
  if (!dates.length) return [];
  const rows = await sbSelectWhere<Row>(TABLE, (q) =>
    q.in("review_date", dates).order("informed_at", { ascending: false }),
  );
  return rows.map(mapRow);
}

export async function getFlagInformed(
  reviewDate: string,
  vaId: string,
): Promise<DailyReviewFlagInformed | null> {
  const date = toReviewDateKey(reviewDate);
  const id = vaId.trim();
  if (!date || !id) return null;
  const rows = await sbSelectWhere<Row>(TABLE, (q) =>
    q.eq("review_date", date).eq("va_id", id).limit(1),
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function upsertFlagInformed(
  input: UpsertDailyReviewFlagInformedInput,
): Promise<DailyReviewFlagInformed> {
  const date = toReviewDateKey(input.review_date);
  const vaId = input.va_id.trim();
  if (!date) throw new Error("review_date is required");
  if (!vaId) throw new Error("va_id is required");

  const now = new Date().toISOString();
  const payload = {
    review_date: date,
    va_id: vaId,
    va_name: (input.va_name ?? "").trim(),
    informed_by: input.informed_by.trim(),
    informed_by_name: (input.informed_by_name ?? "").trim(),
    informed_at: now,
    updated_at: now,
  };

  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(TABLE)
    .upsert(payload, { onConflict: "review_date,va_id" })
    .select("*")
    .single();

  if (error) throw new Error(`upsertFlagInformed: ${error.message}`);
  return mapRow(data as Row);
}

export async function clearFlagInformed(reviewDate: string, vaId: string): Promise<void> {
  const date = toReviewDateKey(reviewDate);
  const id = vaId.trim();
  if (!date || !id) return;
  const sb = getSupabaseServiceClient();
  const { error } = await sb.from(TABLE).delete().eq("review_date", date).eq("va_id", id);
  if (error) throw new Error(`clearFlagInformed: ${error.message}`);
}
