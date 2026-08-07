import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { submitBunchEditedUpload } from "@/services/editing";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canView = await hasPermission(session, PERMISSIONS.EDITING_VIEW_ASSIGNMENTS);
  const canManage = await hasPermission(session, PERMISSIONS.EDITING_MANAGE);
  if (!canView && !canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = (await req.json()) as Record<string, unknown>;
  try {
    const bunch = await submitBunchEditedUpload({
      bunch_id: id,
      edited_upload_folder_link: String(body.edited_upload_folder_link ?? ""),
      actor_user_id: session.airtableUserId ?? session.id,
      actor_user_name: (session.fullName || session.email || "").trim(),
      allowManage: canManage,
    });
    return NextResponse.json({ bunch });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}
