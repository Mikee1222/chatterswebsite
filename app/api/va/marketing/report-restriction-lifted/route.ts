import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasAnyPermission } from "@/lib/rbac";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { ROUTES } from "@/lib/routes";
import { vaTypeAccessApiGuardForNavHref } from "@/lib/va-type-access";
import { formatLiftedReportNotes } from "@/lib/shadowban-helpers";
import { createShadowbanReport, getAccountsByVA, hasPendingLiftedReport } from "@/services/marketing";
import { notifyByRoleConfig } from "@/services/notification-service";
import { shadowbanLiftedReportedPersonal } from "@/lib/notification-copy";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

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

  let body: { account_id?: string; notes?: string };
  try {
    body = (await req.json()) as { account_id?: string; notes?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const account_id = String(body.account_id ?? "").trim();
  if (!account_id) {
    return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  }

  const vaId = session.airtableUserId ?? session.id;
  const vaAccounts = await getAccountsByVA(vaId);
  const account = vaAccounts.find((a) => a.account_id === account_id);
  if (!account) {
    return NextResponse.json({ error: "Account not found or not assigned to you" }, { status: 404 });
  }

  const status = account.account_status ?? "active";
  if (status !== "shadowbanned" && status !== "banned") {
    return NextResponse.json(
      { error: "Only shadowbanned or banned accounts can report a restriction lift" },
      { status: 400 },
    );
  }

  if (await hasPendingLiftedReport(account_id)) {
    return NextResponse.json(
      { error: "A lift report is already pending admin confirmation for this account" },
      { status: 409 },
    );
  }

  const reporterId = session.airtableUserId ?? session.id;
  const reporterName = session.fullName?.trim() || session.email || "User";
  const reporterRole = isVa ? "virtual_assistant" : session.role;
  const rawNotes = String(body.notes ?? "").trim();
  const notes = formatLiftedReportNotes(rawNotes);

  const report = await createShadowbanReport({
    account_id: account.account_id,
    model_id: account.model_id,
    model_name: account.model_name,
    platform: account.platform,
    username: account.username,
    reported_by_id: reporterId,
    reported_by_name: reporterName,
    reported_by_role: reporterRole,
    notes,
  });

  const selfCopy = shadowbanLiftedReportedPersonal(account.username, account.platform);
  await notifyByRoleConfig(NOTIFICATION_EVENT.SHADOWBAN_LIFTED_REPORTED, {
    personal_user_id: reporterId,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title: selfCopy.title,
    body: selfCopy.body,
    entity_type: "shadowban_report",
    entity_id: report.report_id,
    actor_user_id: reporterId,
    actor_name: reporterName,
    context: {
      username: account.username,
      platform: account.platform,
      modelName: account.model_name,
      reporterName,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, report });
}
