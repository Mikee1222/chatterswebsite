import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { listIcloudOrganizationWork } from "@/services/icloud";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canView = await hasPermission(session, PERMISSIONS.ICLOUD_MANAGEMENT_VIEW);
  const canManage = await hasPermission(session, PERMISSIONS.ICLOUD_MANAGEMENT_MANAGE);
  if (!canView && !canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const work = await listIcloudOrganizationWork();
    return NextResponse.json({ work });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
