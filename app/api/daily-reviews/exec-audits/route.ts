import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { createExecAudit } from "@/services/marketing-reviews";

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.DAILY_REVIEW_SUBMIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const dailyReviewId = String(body.daily_review_id ?? "").trim();
  if (!dailyReviewId) {
    return NextResponse.json({ error: "daily_review_id is required" }, { status: 400 });
  }

  const execAudit = await createExecAudit({
    daily_review_id: dailyReviewId,
    exec_va_id: String(body.exec_va_id ?? ""),
    exec_va_name: String(body.exec_va_name ?? ""),
    reviewing_day: body.reviewing_day != null ? String(body.reviewing_day) : undefined,
    phase1_on_time: body.phase1_on_time === true,
    phase2_on_time: body.phase2_on_time === true,
    screenshots_authentic: body.screenshots_authentic === true,
    posting_compliance: body.posting_compliance === true,
    engagement_looks_real: body.engagement_looks_real === true,
    issues_found: String(body.issues_found ?? ""),
    actions_taken: String(body.actions_taken ?? ""),
    audit_label: body.audit_label != null ? String(body.audit_label) : undefined,
  });
  return NextResponse.json({ execAudit });
}
