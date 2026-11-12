import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { listRawSortingWork } from "@/services/icloud";

/** Bunches whose raw footage the filmer uploaded and the iCloud manager has not sorted yet. */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canView = await hasPermission(session, PERMISSIONS.ICLOUD_MANAGEMENT_VIEW);
  const canManage = await hasPermission(session, PERMISSIONS.ICLOUD_MANAGEMENT_MANAGE);
  if (!canView && !canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const work = await listRawSortingWork().catch(() => []);
  return NextResponse.json({ work });
}
