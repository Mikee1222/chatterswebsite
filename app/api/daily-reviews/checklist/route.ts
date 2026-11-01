import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { parseDailyReviewFilters } from "@/lib/daily-review-filters";
import {
  spotCheckManagerId,
  spotCheckManagerName,
  toReviewDateKey,
  todayReviewIso,
} from "@/lib/marketing-reviews-helpers";
import {
  createDailyReview,
  getDailyReviewByDate,
} from "@/services/marketing-reviews";
import { getDailyReviewChecklistForDate } from "@/services/daily-review-checklist";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.DAILY_REVIEW_SUBMIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  const date = toReviewDateKey(dateParam) || todayReviewIso();
  const filters = parseDailyReviewFilters(url.searchParams);
  const managerName = spotCheckManagerName(session);
  const managerId = spotCheckManagerId(session);
  const review = await getDailyReviewByDate(date, managerName, managerId);
  const checklist = await getDailyReviewChecklistForDate({
    date,
    reviewId: review?.id ?? null,
    filters,
  });
  // Screenshots (signed URLs) are part of the live checklist — same payload for
  // manager/supervisor submit as admin manage. Gated by DAILY_REVIEW_SUBMIT.
  return NextResponse.json({ checklist, review });
}

/** Ensure a review exists for (supervisor, date), then return checklist. */
export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.DAILY_REVIEW_SUBMIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    date?: string;
    filters?: Record<string, string | string[] | undefined | null>;
  };
  const date = toReviewDateKey(body.date) || todayReviewIso();
  const filters = body.filters
    ? parseDailyReviewFilters(body.filters)
    : parseDailyReviewFilters(new URLSearchParams());
  const managerName = spotCheckManagerName(session);
  const managerId = spotCheckManagerId(session);
  const review = await createDailyReview({
    manager_name: managerName,
    manager_id: managerId,
    review_date: date,
  });
  const checklist = await getDailyReviewChecklistForDate({
    date,
    reviewId: review.id,
    filters,
  });
  return NextResponse.json({ checklist, review });
}
