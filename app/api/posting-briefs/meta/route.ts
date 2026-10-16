import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { listActiveGunzoTeamModelss } from "@/services/modelss";
import { getAccountsByModel } from "@/services/marketing";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = await hasPermission(session, PERMISSIONS.POSTING_BRIEFS_MANAGE);
  const canView = await hasPermission(session, PERMISSIONS.POSTING_BRIEFS_VIEW);
  if (!canManage && !canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const models = await listActiveGunzoTeamModelss().catch(() => []);
  const accountsByModel: Record<
    string,
    Array<{ username: string; account_type: "main" | "secondary"; region: string }>
  > = {};

  if (canManage) {
    await Promise.all(
      models.slice(0, 80).map(async (m) => {
        const accounts = await getAccountsByModel(m.id).catch(() => []);
        accountsByModel[m.id] = accounts
          .filter((a) => a.active !== false && a.username?.trim())
          .map((a) => ({
            username: a.username.trim(),
            account_type: a.account_type,
            region: a.region,
          }));
      }),
    );
  }

  return NextResponse.json({
    canManage,
    models: models.map((m) => ({ id: m.id, model_name: m.model_name })),
    accountsByModel,
  });
}
