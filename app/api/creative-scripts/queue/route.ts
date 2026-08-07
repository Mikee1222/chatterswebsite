import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getScriptsQueue } from "@/services/winner-videos";
import {
  listBunchScriptProgressForCreative,
  listSlotScriptMetaForCreative,
} from "@/services/winner-sourcing";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CREATIVE_SCRIPTS_SUBMIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const creativeId = session.airtableUserId ?? session.id;
  const [videos, bunchProgress, slotMeta] = await Promise.all([
    getScriptsQueue(creativeId),
    listBunchScriptProgressForCreative(creativeId).catch(() => []),
    listSlotScriptMetaForCreative(creativeId).catch(() => []),
  ]);
  return NextResponse.json({ videos, bunchProgress, slotMeta });
}
