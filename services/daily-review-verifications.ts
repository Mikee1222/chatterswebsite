/**
 * Daily Review item verifications — QA overlay on VA checklist items.
 * Supabase is source of truth. Does not auto-trigger Mistakes.
 */
import { isSupabaseBackend } from "@/lib/data-backend";

export type DailyReviewVerifiedStatus = "verified" | "flagged_not_done";

export interface DailyReviewItemVerification {
  id: string;
  review_id: string;
  task_phase_item_id: string;
  task_id: string;
  phase_id: string;
  va_id: string;
  va_name: string;
  item_title: string;
  verified_status: DailyReviewVerifiedStatus;
  verified_by: string;
  verified_by_name: string;
  verified_at: string;
  note: string | null;
}

export type UpsertDailyReviewItemVerificationInput = {
  review_id: string;
  task_phase_item_id: string;
  verified_status: DailyReviewVerifiedStatus;
  verified_by: string;
  verified_by_name?: string;
  va_id?: string;
  va_name?: string;
  task_id?: string;
  phase_id?: string;
  item_title?: string;
  note?: string | null;
};

function requireSupabase(): void {
  if (!isSupabaseBackend()) {
    throw new Error("Daily review item verifications require DATA_BACKEND=supabase");
  }
}

export async function listVerificationsForReview(
  reviewPublicId: string,
): Promise<DailyReviewItemVerification[]> {
  requireSupabase();
  return (await import("./daily-review-verifications-supabase")).listVerificationsForReview(reviewPublicId);
}

export async function listVerificationsForReviews(
  reviewPublicIds: string[],
): Promise<DailyReviewItemVerification[]> {
  requireSupabase();
  return (await import("./daily-review-verifications-supabase")).listVerificationsForReviews(reviewPublicIds);
}

export async function listVerificationsForDateRange(params: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<DailyReviewItemVerification[]> {
  requireSupabase();
  return (await import("./daily-review-verifications-supabase")).listVerificationsForDateRange(params);
}

export async function upsertItemVerification(
  input: UpsertDailyReviewItemVerificationInput,
): Promise<DailyReviewItemVerification> {
  requireSupabase();
  return (await import("./daily-review-verifications-supabase")).upsertItemVerification(input);
}

export async function clearItemVerification(
  reviewPublicId: string,
  taskPhaseItemId: string,
): Promise<void> {
  requireSupabase();
  return (await import("./daily-review-verifications-supabase")).clearItemVerification(
    reviewPublicId,
    taskPhaseItemId,
  );
}

export async function deleteVerificationById(id: string): Promise<void> {
  requireSupabase();
  return (await import("./daily-review-verifications-supabase")).deleteVerificationById(id);
}
