import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSessionFromCookies } from "@/lib/auth";
import { hasAnyPermission } from "@/lib/rbac";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { ROUTES } from "@/lib/routes";
import { vaTypeAccessApiGuardForNavHref } from "@/lib/va-type-access";
import { createShadowbanReport } from "@/services/marketing";
import { notifyAdmins } from "@/services/notification-service";
import { NOTIFICATION_EVENT, NOTIFICATION_ENTITY, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasAnyPermission(session, ["marketing:manage", "marketing:shadowban-report"]))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const staff = getEffectiveStaffRole(session);
  const isVa = staff === "virtual_assistant";
  if (isVa) {
    const blocked = await vaTypeAccessApiGuardForNavHref(session, ROUTES.va.marketingAccounts);
    if (blocked) return blocked;
  }

  const formData = await req.formData();
  const account_id = String(formData.get("account_id") ?? "").trim();
  const model_id = String(formData.get("model_id") ?? "").trim();
  const model_name = String(formData.get("model_name") ?? "").trim();
  const platform = String(formData.get("platform") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const rawNotes = String(formData.get("notes") ?? "").trim();
  const reportTypeRaw = String(formData.get("report_type") ?? "").trim();
  const report_type: "shadowbanned" | "banned" = reportTypeRaw === "banned" ? "banned" : "shadowbanned";
  const notes =
    report_type === "banned"? rawNotes
        ? `[Ban reported] ${rawNotes}`
        : "[Ban reported]": rawNotes
        ? `[Shadowban reported] ${rawNotes}`
        : "[Shadowban reported]";
  const screenshot = formData.get("screenshot");

  if (!account_id || !platform || !username) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  let screenshotAttachment: { url: string }[] = [];
  if (screenshot instanceof Blob && screenshot.size > 0) {
    try {
      const name =
        screenshot instanceof File && screenshot.name
          ? screenshot.name
          : `screenshot-${Date.now()}.png`;
      const blob = await put(`shadowban-reports/${account_id}/${Date.now()}-${name}`, screenshot, {
        access: "public",
      });
      screenshotAttachment = [{ url: blob.url }];
    } catch (e) {
      console.error("[shadowban report] screenshot upload failed:", e);
    }
  }

  const reporterId = session.airtableUserId ?? session.id;
  const reporterName = session.fullName?.trim() || session.email || "User";
  const reporterRole = isVa ? "virtual_assistant" : session.role;

  const report = await createShadowbanReport({
    account_id,
    model_id,
    model_name,
    platform,
    username,
    reported_by_id: reporterId,
    reported_by_name: reporterName,
    reported_by_role: reporterRole,
    notes,
    screenshot: screenshotAttachment,
  });

  const who = reporterName;
  const isBan = report_type === "banned";
  await notifyAdmins({
    event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
    priority: NOTIFICATION_PRIORITY.HIGH,
    title: `${isBan ? "" : ""} ${isBan ? "Ban" : "Shadowban"} reported: @${username}`,
    body: `${who} reported ${report_type} on ${platform} for ${model_name || "model"} (@${username})`,
    entity_type: NOTIFICATION_ENTITY.ACCOUNT,
    entity_id: report.report_id,
    _triggerSource: "va_marketing_report_shadowban",
  }).catch(() => {});

  return NextResponse.json({ success: true, report });
}
