import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { filterSpotChecksByManager, spotCheckManagerName } from "@/lib/marketing-reviews-helpers";
import {
  createSpotCheck,
  getSpotChecks,
  type SpotCheckStatus,
  type SpotCheckType,
} from "@/services/marketing-reviews";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.SPOTCHECK_SUBMIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const managerName = spotCheckManagerName(session);
  const all = await getSpotChecks();
  const spotChecks = filterSpotChecksByManager(all, managerName);
  return NextResponse.json({ spotChecks });
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.SPOTCHECK_SUBMIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const spotCheck = await createSpotCheck({
    manager_name: spotCheckManagerName(session),
    manager_id: session.airtableUserId ?? session.id,
    type: body.type as SpotCheckType | undefined,
    exec_va_id: String(body.exec_va_id ?? ""),
    exec_va_name: String(body.exec_va_name ?? ""),
    creator_id: String(body.creator_id ?? ""),
    creator_name: String(body.creator_name ?? ""),
    what_was_wrong: String(body.what_was_wrong ?? ""),
    action_taken: String(body.action_taken ?? ""),
    status: (body.status as SpotCheckStatus | undefined) ?? "Pending",
    subject: body.subject != null ? String(body.subject) : undefined,
  });
  return NextResponse.json({ spotCheck });
}
