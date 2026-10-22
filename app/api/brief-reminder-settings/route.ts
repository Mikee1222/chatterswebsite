import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getBriefReminderLeadHours,
  setBriefReminderLeadHours,
} from "@/services/brief-reminder-settings";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const can =
    (await hasPermission(session, PERMISSIONS.RECORDING_BRIEFS_MANAGE)) ||
    (await hasPermission(session, PERMISSIONS.EDITING_BRIEFS_MANAGE)) ||
    (await hasPermission(session, PERMISSIONS.SETTINGS_MANAGE)) ||
    (await hasPermission(session, PERMISSIONS.RECORDING_BRIEFS_VIEW_ALL)) ||
    (await hasPermission(session, PERMISSIONS.EDITING_BRIEFS_VIEW_ALL));
  if (!can) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const hours = await getBriefReminderLeadHours();
  return NextResponse.json({ lead_hours: hours });
}

export async function PATCH(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const can =
    (await hasPermission(session, PERMISSIONS.SETTINGS_MANAGE)) ||
    (await hasPermission(session, PERMISSIONS.RECORDING_BRIEFS_MANAGE)) ||
    (await hasPermission(session, PERMISSIONS.EDITING_BRIEFS_MANAGE));
  if (!can) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as { lead_hours?: number };
  try {
    const hours = await setBriefReminderLeadHours(Number(body.lead_hours));
    return NextResponse.json({ lead_hours: hours });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}
