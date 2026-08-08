/**
 * Supabase persistence for daily_review_item_verifications.
 * QA overlay only — does not create Mistakes / fines.
 */
import {
  publicId,
  sbDeleteByPublicId,
  sbSelectByPublicId,
  sbSelectWhere,
  sbUuidsForAirtableIds,
  type SbRow,
} from "@/lib/supabase-data";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import type {
  DailyReviewItemVerification,
  DailyReviewVerifiedStatus,
  UpsertDailyReviewItemVerificationInput,
} from "./daily-review-verifications";

const TABLE = "daily_review_item_verifications";
const TABLE_REVIEWS = "marketing_daily_reviews";

type Row = SbRow & {
  review_id?: string | null;
  task_phase_item_id?: string | null;
  task_id?: string | null;
  phase_id?: string | null;
  va_id?: string | null;
  va_name?: string | null;
  item_title?: string | null;
  verified_status?: string | null;
  verified_by?: string | null;
  verified_by_name?: string | null;
  verified_at?: string | null;
  note?: string | null;
};

function coerceStatus(v: unknown): DailyReviewVerifiedStatus {
  return v === "flagged_not_done" ? "flagged_not_done" : "verified";
}

function mapRow(row: Row, reviewPublicId: string): DailyReviewItemVerification {
  return {
    id: publicId(row),
    review_id: reviewPublicId,
    task_phase_item_id: String(row.task_phase_item_id ?? ""),
    task_id: String(row.task_id ?? ""),
    phase_id: String(row.phase_id ?? ""),
    va_id: String(row.va_id ?? ""),
    va_name: String(row.va_name ?? ""),
    item_title: String(row.item_title ?? ""),
    verified_status: coerceStatus(row.verified_status),
    verified_by: String(row.verified_by ?? ""),
    verified_by_name: String(row.verified_by_name ?? ""),
    verified_at: row.verified_at ?? "",
    note: row.note != null ? String(row.note) : null,
  };
}

async function resolveReviewUuid(reviewPublicId: string): Promise<{ uuid: string; publicId: string }> {
  const row = await sbSelectByPublicId<{ id: string; airtable_id?: string | null }>(
    TABLE_REVIEWS,
    reviewPublicId,
  );
  if (!row) throw new Error("Daily review not found");
  return { uuid: row.id, publicId: publicId(row) };
}

async function reviewPublicIdForUuid(uuid: string): Promise<string> {
  const row = await sbSelectByPublicId<{ id: string; airtable_id?: string | null }>(TABLE_REVIEWS, uuid);
  return row ? publicId(row) : uuid;
}

export async function listVerificationsForReview(
  reviewPublicId: string,
): Promise<DailyReviewItemVerification[]> {
  const { uuid, publicId: pub } = await resolveReviewUuid(reviewPublicId);
  const rows = await sbSelectWhere<Row>(TABLE, (q) => q.eq("review_id", uuid).order("verified_at", { ascending: false }));
  return rows.map((r) => mapRow(r, pub));
}

export async function listVerificationsForReviews(
  reviewPublicIds: string[],
): Promise<DailyReviewItemVerification[]> {
  const ids = [...new Set(reviewPublicIds.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) return [];
  const uuids = await sbUuidsForAirtableIds(TABLE_REVIEWS, ids);
  if (!uuids.length) return [];

  const rows = await sbSelectWhere<Row>(TABLE, (q) => q.in("review_id", uuids).order("verified_at", { ascending: false }));
  const uuidToPublic = new Map<string, string>();
  await Promise.all(
    uuids.map(async (u) => {
      uuidToPublic.set(u, await reviewPublicIdForUuid(u));
    }),
  );
  return rows.map((r) => mapRow(r, uuidToPublic.get(String(r.review_id ?? "")) ?? String(r.review_id ?? "")));
}

export async function listVerificationsForDateRange(params: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<DailyReviewItemVerification[]> {
  const sb = getSupabaseServiceClient();
  let reviewQ = sb.from(TABLE_REVIEWS).select("id, airtable_id, review_date");
  if (params.dateFrom?.trim()) reviewQ = reviewQ.gte("review_date", params.dateFrom.trim().slice(0, 10));
  if (params.dateTo?.trim()) reviewQ = reviewQ.lte("review_date", params.dateTo.trim().slice(0, 10));
  const { data: reviews, error } = await reviewQ;
  if (error) throw new Error(`listVerificationsForDateRange reviews: ${error.message}`);
  const reviewRows = (reviews ?? []) as Array<{ id: string; airtable_id?: string | null }>;
  if (!reviewRows.length) return [];

  const uuidToPublic = new Map(reviewRows.map((r) => [r.id, publicId(r)]));
  const uuids = reviewRows.map((r) => r.id);
  const rows = await sbSelectWhere<Row>(TABLE, (q) => q.in("review_id", uuids).order("verified_at", { ascending: false }));
  return rows.map((r) => mapRow(r, uuidToPublic.get(String(r.review_id ?? "")) ?? String(r.review_id ?? "")));
}

export async function upsertItemVerification(
  input: UpsertDailyReviewItemVerificationInput,
): Promise<DailyReviewItemVerification> {
  const itemId = input.task_phase_item_id.trim();
  if (!itemId) throw new Error("task_phase_item_id is required");
  const { uuid, publicId: reviewPub } = await resolveReviewUuid(input.review_id);
  const status = coerceStatus(input.verified_status);
  const now = new Date().toISOString();

  const sb = getSupabaseServiceClient();
  const payload = {
    review_id: uuid,
    task_phase_item_id: itemId,
    task_id: input.task_id?.trim() ?? "",
    phase_id: input.phase_id?.trim() ?? "",
    va_id: input.va_id?.trim() ?? "",
    va_name: input.va_name?.trim() ?? "",
    item_title: input.item_title?.trim() ?? "",
    verified_status: status,
    verified_by: input.verified_by?.trim() ?? "",
    verified_by_name: input.verified_by_name?.trim() ?? "",
    verified_at: now,
    note: input.note != null ? String(input.note) : null,
    updated_at: now,
  };

  const { data, error } = await sb
    .from(TABLE)
    .upsert(payload, { onConflict: "review_id,task_phase_item_id" })
    .select("*")
    .single();
  if (error) throw new Error(`upsertItemVerification: ${error.message}`);
  return mapRow(data as Row, reviewPub);
}

export async function clearItemVerification(
  reviewPublicId: string,
  taskPhaseItemId: string,
): Promise<void> {
  const { uuid } = await resolveReviewUuid(reviewPublicId);
  const itemId = taskPhaseItemId.trim();
  if (!itemId) return;
  const sb = getSupabaseServiceClient();
  const { error } = await sb
    .from(TABLE)
    .delete()
    .eq("review_id", uuid)
    .eq("task_phase_item_id", itemId);
  if (error) throw new Error(`clearItemVerification: ${error.message}`);
}

export async function deleteVerificationById(id: string): Promise<void> {
  await sbDeleteByPublicId(TABLE, id);
}
