import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission, isSystemAdmin } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { revokeAgentToken } from "@/services/agent-tokens";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSystemAdmin(session) || !(await hasPermission(session, PERMISSIONS.ROLES_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id?.trim()) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    const row = await revokeAgentToken(id);
    if (!row) {
      return NextResponse.json({ error: "Token not found or already revoked" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id: row.id, revoked_at: row.revoked_at });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to revoke";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
