import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getWinnerVideoById, resubmitCreativeScript } from "@/services/winner-videos";
import { isAllowedDirectUploadToken } from "@/lib/direct-storage-upload";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CREATIVE_SCRIPTS_SUBMIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const submitterId = (session.airtableUserId ?? session.id).trim();
  const existing = await getWinnerVideoById(id);
  if (
    !existing ||
    (existing.script_submitted_by_id !== submitterId &&
      existing.assigned_creative_id !== submitterId)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as Record<string, unknown>;

  let script_brief_attachment_url: string | undefined;
  if (body.script_brief_attachment_url !== undefined) {
    const token = String(body.script_brief_attachment_url ?? "").trim();
    if (token) {
      if (!isAllowedDirectUploadToken(token, "creative-script-brief", { itemId: id })) {
        return NextResponse.json({ error: "Invalid brief attachment" }, { status: 400 });
      }
      script_brief_attachment_url = token;
    } else {
      script_brief_attachment_url = "";
    }
  }

  try {
    const video = await resubmitCreativeScript(id, {
      assigned_creator_name: String(body.assigned_creator_name ?? ""),
      script_text: String(body.script_text ?? ""),
      text_on_screen_suggestion: String(body.text_on_screen_suggestion ?? ""),
      script_brief: String(body.script_brief ?? ""),
      script_brief_attachment_url,
      script_submitted_by_name: (session.fullName || session.email || "").trim(),
      script_submitted_by_id: submitterId,
    });
    return NextResponse.json({ video });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not resubmit script";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
