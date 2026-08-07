import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { markBunchIcloudOrganized } from "@/services/icloud";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canView = await hasPermission(session, PERMISSIONS.ICLOUD_MANAGEMENT_VIEW);
  const canManage = await hasPermission(session, PERMISSIONS.ICLOUD_MANAGEMENT_MANAGE);
  if (!canView && !canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  try {
    const bunch = await markBunchIcloudOrganized({
      bunch_id: id,
      actor_user_id: session.airtableUserId ?? session.id,
      actor_user_name: (session.fullName || session.email || "").trim(),
    });
    return NextResponse.json({ bunch });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}
