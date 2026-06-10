import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getRecord, listAllRecords } from "@/lib/airtable-server";
import { updateAccount, updateShadowbanReport } from "@/services/marketing";
import { notify } from "@/services/notification-service";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

function esc(s: string): string {
  return String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

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

  let report: Awaited<ReturnType<typeof getRecord>>;
  try {
    report = await getRecord("shadowban_reports", id);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const f = report.fields as {
    account_id?: string;
    username?: string;
    platform?: string;
    reported_by_id?: string;
    reported_by_name?: string;
    status?: string;
  };

  if (f.status && f.status !== "pending") {
    return NextResponse.json({ error: "Report already reviewed" }, { status: 400 });
  }

  if (action === "approve") {
    await updateShadowbanReport(id, {
      status: "approved",
      reviewed_by: reviewer,
      reviewed_at: now,
    });

    const accountIdField = String(f.account_id ?? "").trim();
    if (accountIdField) {
      const accounts = await listAllRecords("model_social_accounts", {
        filterByFormula: `{account_id} = "${esc(accountIdField)}"`,
      });
      const acc = accounts[0];
      if (acc) {
        await updateAccount(acc.id, {
          account_status: "shadowbanned",
          shadowban_reported_at: now,
          shadowban_reported_by: String(f.reported_by_name ?? "").trim() || "Reporter",
        });
      }
    }

    const reportedById = String(f.reported_by_id ?? "").trim();
    if (reportedById) {
      await notify({
        user_id: reportedById,
        event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: "✅ Shadowban Report Approved",
        body: `✅ Your shadowban report for @${f.username ?? ""} (${f.platform ?? ""}) was approved. The account was marked as shadowbanned.`,
        entity_type: "shadowban_report",
        entity_id: String((f as { report_id?: string }).report_id ?? id),
      }).catch(() => {});
    }
  } else {
    await updateShadowbanReport(id, {
      status: "dismissed",
      reviewed_by: reviewer,
      reviewed_at: now,
    });
  }

  return NextResponse.json({ success: true });
}
