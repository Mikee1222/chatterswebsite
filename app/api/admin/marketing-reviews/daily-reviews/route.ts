import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createDailyReview,
  getDailyReviewByDate,
  getDailyReviews,
} from "@/services/marketing-reviews";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.MARKETING_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const date = new URL(req.url).searchParams.get("date");
  if (date) {
    const review = await getDailyReviewByDate(date);
    return NextResponse.json({ review });
  }

  const reviews = await getDailyReviews();
  return NextResponse.json({ reviews });
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.MARKETING_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const reviewDate = String(body.review_date ?? "").trim();
  if (!reviewDate) {
    return NextResponse.json({ error: "review_date is required" }, { status: 400 });
  }

  const existing = await getDailyReviewByDate(reviewDate);
  if (existing) {
    return NextResponse.json({ error: "A review already exists for this date", review: existing }, { status: 409 });
  }

  const managerName = session.fullName?.trim() || session.email?.trim() || "Manager";
  const review = await createDailyReview({
    manager_name: managerName,
    review_date: reviewDate,
    review_label: body.review_label != null ? String(body.review_label) : undefined,
    overall_kpis_reviewed: Array.isArray(body.overall_kpis_reviewed)
      ? body.overall_kpis_reviewed.map(String)
      : [],
    account_compliance_vs_master: Array.isArray(body.account_compliance_vs_master)
      ? body.account_compliance_vs_master.map(String)
      : [],
    top_performer_id: String(body.top_performer_id ?? ""),
    top_performer_name: String(body.top_performer_name ?? ""),
    issues_found: String(body.issues_found ?? ""),
    actions_assigned: String(body.actions_assigned ?? ""),
    time_spent_minutes: body.time_spent_minutes != null ? Number(body.time_spent_minutes) : null,
  });
  return NextResponse.json({ review });
}
