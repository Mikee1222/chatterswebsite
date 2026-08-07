import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { listShootAssignmentsForFilmer } from "@/services/filming";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canView = await hasPermission(session, PERMISSIONS.FILMING_VIEW_ASSIGNMENTS);
  const canManage = await hasPermission(session, PERMISSIONS.FILMING_MANAGE);
  if (!canView && !canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const filmerId = session.airtableUserId ?? session.id;
  try {
    const assignments = await listShootAssignmentsForFilmer(filmerId);
    return NextResponse.json({ assignments });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
