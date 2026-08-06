import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  filterDailyReviewsByManager,
  spotCheckManagerName,
} from "@/lib/marketing-reviews-helpers";
import {
  getDailyReviewDetail,
  getExecAuditById,
  updateExecAudit,
} from "@/services/marketing-reviews";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.DAILY_REVIEW_SUBMIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const audit = await getExecAuditById(id);
  if (!audit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (audit.daily_review_id) {
    const parent = await getDailyReviewDetail(audit.daily_review_id);
    if (!parent) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const canManage = await hasPermission(session, PERMISSIONS.DAILY_REVIEW_MANAGE);
    if (!canManage) {
      const owned = filterDailyReviewsByManager([parent], spotCheckManagerName(session));
      if (owned.length === 0) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  } else if (!(await hasPermission(session, PERMISSIONS.DAILY_REVIEW_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  await updateExecAudit(id, {
    exec_va_id: body.exec_va_id != null ? String(body.exec_va_id) : undefined,
    exec_va_name: body.exec_va_name != null ? String(body.exec_va_name) : undefined,
    reviewing_day: body.reviewing_day != null ? String(body.reviewing_day) : undefined,
    phase1_on_time: body.phase1_on_time === true ? true : body.phase1_on_time === false ? false : undefined,
    phase2_on_time: body.phase2_on_time === true ? true : body.phase2_on_time === false ? false : undefined,
    screenshots_authentic:
      body.screenshots_authentic === true ? true : body.screenshots_authentic === false ? false : undefined,
    posting_compliance:
      body.posting_compliance === true ? true : body.posting_compliance === false ? false : undefined,
    engagement_looks_real:
      body.engagement_looks_real === true ? true : body.engagement_looks_real === false ? false : undefined,
    issues_found: body.issues_found != null ? String(body.issues_found) : undefined,
    actions_taken: body.actions_taken != null ? String(body.actions_taken) : undefined,
  });
  return NextResponse.json({ ok: true });
}
