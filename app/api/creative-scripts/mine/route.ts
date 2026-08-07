import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getMyScripts } from "@/services/winner-videos";
import { listSlotScriptMetaForCreative } from "@/services/winner-sourcing";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CREATIVE_SCRIPTS_SUBMIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const submitterId = (session.airtableUserId ?? session.id).trim();
  const [videos, slotMeta] = await Promise.all([
    getMyScripts(submitterId),
    listSlotScriptMetaForCreative(submitterId).catch(() => []),
  ]);
  return NextResponse.json({ videos, slotMeta });
}
