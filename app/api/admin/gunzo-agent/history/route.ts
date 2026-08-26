import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { listAgentActionLogsForUser } from "@/services/gunzo-agent-log";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.AI_AGENT_USE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminId = (session.airtableUserId ?? session.id)?.trim();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "40");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 40;

  try {
    const logs = await listAgentActionLogsForUser(adminId, { limit });
    return NextResponse.json({ logs });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg || "History failed" }, { status: 500 });
  }
}
