import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  deleteShadowbanReport,
  getAccountByAccountId,
  getShadowbanReportById,
  updateAccount,
  updateShadowbanReport,
} from "@/services/marketing";
import { notifyByRoleConfig } from "@/services/notification-service";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { shadowbanResolvedPersonal } from "@/lib/notification-copy";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "marketing:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  let body: { action?: string };
  try {
    body = (await req.json()) as { action?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const action = body.action;
  if (action !== "approve" && action !== "dismiss") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const reviewer = session.fullName?.trim() || session.email || "Admin";

  const report = await getShadowbanReportById(id);
  if (!report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (report.status && report.status !== "pending") {
    return NextResponse.json({ error: "Report already reviewed" }, { status: 400 });
  }

  if (action === "approve") {
    await updateShadowbanReport(id, {
      status: "approved",
      reviewed_by: reviewer,
      reviewed_at: now,
    });

    const reportType = report.report_type;
    const accountIdField = report.account_id.trim();
    if (accountIdField) {
      const acc = await getAccountByAccountId(accountIdField);
      if (acc) {
        if (reportType === "lifted") {
          await updateAccount(acc.id, {
            account_status: "active",
          });
        } else {
          await updateAccount(acc.id, {
            account_status: reportType === "banned" ? "banned" : "shadowbanned",
            shadowban_reported_at: now,
            shadowban_reported_by: report.reported_by_name.trim() || "Reporter",
          });
        }
      }
    }

    const reportedById = report.reported_by_id.trim();
    if (reportedById) {
      const copy = shadowbanResolvedPersonal(
        report.username,
        report.platform,
        true,
        reportType === "lifted",
      );
      await notifyByRoleConfig(NOTIFICATION_EVENT.SHADOWBAN_RESOLVED, {
        personal_user_id: reportedById,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: copy.title,
        body: copy.body,
        entity_type: "shadowban_report",
        entity_id: report.report_id || id,
        actor_user_id: session.airtableUserId ?? session.id,
        actor_name: reviewer,
        context: {
          username: report.username,
          platform: report.platform,
          approved: true,
          lifted: reportType === "lifted",
        },
      }).catch(() => {});
    }
  } else {
    await updateShadowbanReport(id, {
      status: "dismissed",
      reviewed_by: reviewer,
      reviewed_at: now,
    });

    const reportedById = report.reported_by_id.trim();
    if (reportedById) {
      const reportType = report.report_type;
      const copy = shadowbanResolvedPersonal(
        report.username,
        report.platform,
        false,
        reportType === "lifted",
      );
      await notifyByRoleConfig(NOTIFICATION_EVENT.SHADOWBAN_RESOLVED, {
        personal_user_id: reportedById,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: copy.title,
        body: copy.body,
        entity_type: "shadowban_report",
        entity_id: report.report_id || id,
        actor_user_id: session.airtableUserId ?? session.id,
        actor_name: reviewer,
        context: {
          username: report.username,
          platform: report.platform,
          approved: false,
          lifted: reportType === "lifted",
        },
      }).catch(() => {});
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "marketing:manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const existing = await getShadowbanReportById(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await deleteShadowbanReport(id);
  return NextResponse.json({ success: true });
}
