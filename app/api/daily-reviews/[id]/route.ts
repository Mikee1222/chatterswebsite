import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getDailyReviewDetail, updateDailyReview } from "@/services/marketing-reviews";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.DAILY_REVIEW_SUBMIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const review = await getDailyReviewDetail(id);
  if (!review) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ review });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.DAILY_REVIEW_SUBMIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const existing = await getDailyReviewDetail(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as Record<string, unknown>;
  await updateDailyReview(id, {
    review_label: body.review_label != null ? String(body.review_label) : undefined,
    overall_kpis_reviewed: Array.isArray(body.overall_kpis_reviewed)
      ? body.overall_kpis_reviewed.map(String)
      : undefined,
    account_compliance_vs_master: Array.isArray(body.account_compliance_vs_master)
      ? body.account_compliance_vs_master.map(String)
      : undefined,
    top_performer_id: body.top_performer_id != null ? String(body.top_performer_id) : undefined,
    top_performer_name: body.top_performer_name != null ? String(body.top_performer_name) : undefined,
    issues_found: body.issues_found != null ? String(body.issues_found) : undefined,
    actions_assigned: body.actions_assigned != null ? String(body.actions_assigned) : undefined,
    time_spent_minutes: body.time_spent_minutes != null ? Number(body.time_spent_minutes) : undefined,
  });
  const review = await getDailyReviewDetail(id);
  return NextResponse.json({ review });
}
