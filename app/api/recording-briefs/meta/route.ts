import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { listActiveGunzoTeamModelss } from "@/services/modelss";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = await hasPermission(session, PERMISSIONS.RECORDING_BRIEFS_MANAGE);
  const canViewOwn = await hasPermission(session, PERMISSIONS.RECORDING_BRIEFS_VIEW_OWN);
  const canViewAll = await hasPermission(session, PERMISSIONS.RECORDING_BRIEFS_VIEW_ALL);
  if (!canManage && !canViewOwn && !canViewAll) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const models = canManage || canViewAll
    ? await listActiveGunzoTeamModelss().catch(() => [])
    : [];

  return NextResponse.json({
    canManage,
    canViewOwn,
    canViewAll,
    models: models.map((m) => ({ id: m.id, model_name: m.model_name })),
  });
}
