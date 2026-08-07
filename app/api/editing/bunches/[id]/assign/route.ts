import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { assignEditorToBunch } from "@/services/editing";
import { listUsersWithPermission } from "@/services/users";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.EDITING_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = (await req.json()) as Record<string, unknown>;
  let editorId = String(body.assigned_editor_id ?? "").trim();
  let editorName = String(body.assigned_editor_name ?? "").trim();

  if (editorId && !editorName) {
    const editors = await listUsersWithPermission(PERMISSIONS.EDITING_VIEW_ASSIGNMENTS);
    const match = editors.find((u) => u.id === editorId);
    editorName = (match?.full_name || match?.email || "").trim();
  }

  try {
    const bunch = await assignEditorToBunch({
      bunch_id: id,
      assigned_editor_id: editorId,
      assigned_editor_name: editorName,
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
