import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { assignFilmerToBunch } from "@/services/filming";
import { listUsersWithPermission } from "@/services/users";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.FILMING_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = (await req.json()) as Record<string, unknown>;
  let filmerId = String(body.assigned_filmer_id ?? "").trim();
  let filmerName = String(body.assigned_filmer_name ?? "").trim();

  if (filmerId && !filmerName) {
    const filmers = await listUsersWithPermission(PERMISSIONS.FILMING_VIEW_ASSIGNMENTS);
    const match = filmers.find((u) => u.id === filmerId);
    filmerName = (match?.full_name || match?.email || "").trim();
  }

  try {
    const bunch = await assignFilmerToBunch({
      bunch_id: id,
      assigned_filmer_id: filmerId,
      assigned_filmer_name: filmerName,
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
