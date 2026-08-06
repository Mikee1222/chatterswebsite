import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getMyProfilesData } from "@/services/my-profiles";
import { listActiveGunzoTeamModelss } from "@/services/modelss";

/**
 * Models available for Winner/Super Winner submission.
 * - Manage: all active Gunzo team models
 * - Submit only: models assigned via marketing social accounts (My Profiles)
 */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canManage = await hasPermission(session, PERMISSIONS.WINNER_SOURCING_MANAGE);
  const canSubmit = await hasPermission(session, PERMISSIONS.WINNER_SOURCING_SUBMIT);
  if (!canManage && !canSubmit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (canManage) {
    const models = await listActiveGunzoTeamModelss().catch(() => []);
    return NextResponse.json({
      models: models.map((m) => ({
        model_id: m.id || m.model_id,
        model_name: m.model_name || m.model_id || "Creator",
      })),
    });
  }

  const uid = session.airtableUserId ?? session.id;
  const data = await getMyProfilesData(uid);
  return NextResponse.json({
    models: data.models.map((m) => ({
      model_id: m.model_id,
      model_name: m.model_name,
    })),
  });
}
