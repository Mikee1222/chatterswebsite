import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { listActiveGunzoTeamModelss } from "@/services/modelss";
import { listUsersWithPermission } from "@/services/users";
import { listRecordingBriefs } from "@/services/recording-briefs";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = await hasPermission(session, PERMISSIONS.EDITING_BRIEFS_MANAGE);
  const canViewAssigned = await hasPermission(
    session,
    PERMISSIONS.EDITING_BRIEFS_VIEW_ASSIGNED,
  );
  const canReview = await hasPermission(session, PERMISSIONS.EDITING_BRIEFS_REVIEW);
  const canViewAll = await hasPermission(session, PERMISSIONS.EDITING_BRIEFS_VIEW_ALL);
  if (!canManage && !canViewAssigned && !canReview && !canViewAll) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [models, editors, recordingBriefs] = await Promise.all([
    canManage || canReview || canViewAll
      ? listActiveGunzoTeamModelss().catch(() => [])
      : Promise.resolve([]),
    canManage
      ? listUsersWithPermission(PERMISSIONS.EDITING_BRIEFS_VIEW_ASSIGNED).catch(() => [])
      : Promise.resolve([]),
    canManage
      ? listRecordingBriefs({ status: "all" }).catch(() => [])
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    canManage,
    canViewAssigned,
    canReview,
    canViewAll,
    models: models.map((m) => ({ id: m.id, model_name: m.model_name })),
    editors: editors.map((u) => ({
      id: u.id,
      full_name: u.full_name || u.email || u.id,
      email: u.email,
    })),
    recordingBriefs: recordingBriefs.map((b) => ({ id: b.id, title: b.title || b.id })),
  });
}
