/**
 * Daily Review flag-informed tracking — who was told about flagged items (person + date).
 * Supabase service-role only. Does not change flag/verification storage.
 */
import { isSupabaseBackend } from "@/lib/data-backend";

export interface DailyReviewFlagInformed {
  id: string;
  review_date: string;
  va_id: string;
  va_name: string;
  informed_by: string;
  informed_by_name: string;
  informed_at: string;
}

export type UpsertDailyReviewFlagInformedInput = {
  review_date: string;
  va_id: string;
  va_name?: string;
  informed_by: string;
  informed_by_name?: string;
};

function requireSupabase(): void {
  if (!isSupabaseBackend()) {
    throw new Error("Daily review flag-informed requires DATA_BACKEND=supabase");
  }
}

export async function listFlagInformedForDate(
  reviewDate: string,
): Promise<DailyReviewFlagInformed[]> {
  requireSupabase();
  return (await import("./daily-review-flag-informed-supabase")).listFlagInformedForDate(
    reviewDate,
  );
}

export async function listFlagInformedForDates(
  reviewDates: string[],
): Promise<DailyReviewFlagInformed[]> {
  requireSupabase();
  return (await import("./daily-review-flag-informed-supabase")).listFlagInformedForDates(
    reviewDates,
  );
}

export async function getFlagInformed(
  reviewDate: string,
  vaId: string,
): Promise<DailyReviewFlagInformed | null> {
  requireSupabase();
  return (await import("./daily-review-flag-informed-supabase")).getFlagInformed(
    reviewDate,
    vaId,
  );
}

export async function upsertFlagInformed(
  input: UpsertDailyReviewFlagInformedInput,
): Promise<DailyReviewFlagInformed> {
  requireSupabase();
  return (await import("./daily-review-flag-informed-supabase")).upsertFlagInformed(input);
}

export async function clearFlagInformed(reviewDate: string, vaId: string): Promise<void> {
  requireSupabase();
  return (await import("./daily-review-flag-informed-supabase")).clearFlagInformed(
    reviewDate,
    vaId,
  );
}
