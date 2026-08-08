import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { spotCheckManagerId, spotCheckManagerName } from "@/lib/marketing-reviews-helpers";
import {
  createDailyReview,
  getDailyReviewByDate,
  getDailyReviews,
  type DailyReviewFilters,
} from "@/services/marketing-reviews";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.DAILY_REVIEW_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (date) {
    const managerParam = url.searchParams.get("manager_name")?.trim();
    const managerIdParam = url.searchParams.get("manager_id")?.trim();
    const managerName = managerParam || spotCheckManagerName(session);
    const managerId = managerIdParam || (managerParam ? undefined : spotCheckManagerId(session));
    const review = await getDailyReviewByDate(date, managerName, managerId);
    return NextResponse.json({ review });
  }

  const filters: DailyReviewFilters = {
    date_from: url.searchParams.get("date_from") ?? undefined,
    date_to: url.searchParams.get("date_to") ?? undefined,
    manager_name: url.searchParams.get("manager_name") ?? undefined,
    manager_id: url.searchParams.get("manager_id") ?? undefined,
  };
  const hasAttachment = url.searchParams.get("has_attachment");
  if (hasAttachment === "true") filters.has_attachment = true;
  if (hasAttachment === "false") filters.has_attachment = false;
  const hasIssues = url.searchParams.get("has_issues");
  if (hasIssues === "true") filters.has_issues = true;
  if (hasIssues === "false") filters.has_issues = false;
  const execAudit = url.searchParams.get("exec_audit_complete");
  if (execAudit === "true") filters.exec_audit_complete = true;
  if (execAudit === "false") filters.exec_audit_complete = false;

  const reviews = await getDailyReviews(filters);
  return NextResponse.json({ reviews });
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.DAILY_REVIEW_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const reviewDate = String(body.review_date ?? "").trim();
  if (!reviewDate) {
    return NextResponse.json({ error: "review_date is required" }, { status: 400 });
  }

  const managerName = spotCheckManagerName(session);
  const managerId = spotCheckManagerId(session);
  const existing = await getDailyReviewByDate(reviewDate, managerName, managerId);
  if (existing) {
    return NextResponse.json({ error: "A review already exists for this date", review: existing }, { status: 409 });
  }

  const review = await createDailyReview({
    manager_name: managerName,
    manager_id: managerId,
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
