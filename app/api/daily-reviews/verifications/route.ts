import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  spotCheckManagerId,
  spotCheckManagerName,
  toReviewDateKey,
  todayReviewIso,
} from "@/lib/marketing-reviews-helpers";
import { createDailyReview, getDailyReviewByDate } from "@/services/marketing-reviews";
import {
  clearItemVerification,
  upsertItemVerification,
  type DailyReviewVerifiedStatus,
} from "@/services/daily-review-verifications";

async function ensureReview(session: {
  fullName?: string | null;
  email?: string | null;
  airtableUserId?: string | null;
  id: string;
}, dateRaw: string) {
  const date = toReviewDateKey(dateRaw) || todayReviewIso();
  const managerName = spotCheckManagerName(session);
  const managerId = spotCheckManagerId(session);
  const existing = await getDailyReviewByDate(date, managerName, managerId);
  if (existing) return existing;
  return createDailyReview({
    manager_name: managerName,
    manager_id: managerId,
    review_date: date,
  });
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.DAILY_REVIEW_SUBMIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    date?: string;
    review_id?: string;
    task_phase_item_id?: string;
    verified_status?: string;
    va_id?: string;
    va_name?: string;
    task_id?: string;
    phase_id?: string;
    item_title?: string;
    note?: string | null;
  };

  const itemId = String(body.task_phase_item_id ?? "").trim();
  if (!itemId) {
    return NextResponse.json({ error: "task_phase_item_id is required" }, { status: 400 });
  }
  const status = String(body.verified_status ?? "").trim() as DailyReviewVerifiedStatus;
  if (status !== "verified" && status !== "flagged_not_done") {
    return NextResponse.json({ error: "verified_status must be verified or flagged_not_done" }, { status: 400 });
  }

  const date = toReviewDateKey(body.date) || todayReviewIso();
  let reviewId = String(body.review_id ?? "").trim();
  if (!reviewId) {
    const review = await ensureReview(session, date);
    reviewId = review.id;
  }

  const verification = await upsertItemVerification({
    review_id: reviewId,
    task_phase_item_id: itemId,
    verified_status: status,
    verified_by: spotCheckManagerId(session),
    verified_by_name: spotCheckManagerName(session),
    va_id: body.va_id,
    va_name: body.va_name,
    task_id: body.task_id,
    phase_id: body.phase_id,
    item_title: body.item_title,
    note: body.note,
  });

  return NextResponse.json({ verification, review_id: reviewId });
}

export async function DELETE(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.DAILY_REVIEW_SUBMIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    date?: string;
    review_id?: string;
    task_phase_item_id?: string;
  };
  const itemId = String(body.task_phase_item_id ?? "").trim();
  if (!itemId) {
    return NextResponse.json({ error: "task_phase_item_id is required" }, { status: 400 });
  }

  let reviewId = String(body.review_id ?? "").trim();
  if (!reviewId) {
    const date = toReviewDateKey(body.date) || todayReviewIso();
    const review = await getDailyReviewByDate(
      date,
      spotCheckManagerName(session),
      spotCheckManagerId(session),
    );
    if (!review) return NextResponse.json({ ok: true });
    reviewId = review.id;
  }

  await clearItemVerification(reviewId, itemId);
  return NextResponse.json({ ok: true });
}
