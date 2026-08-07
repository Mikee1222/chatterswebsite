import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { submitCreativeScript } from "@/services/winner-videos";
import { isAllowedDirectUploadToken } from "@/lib/direct-storage-upload";

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CREATIVE_SCRIPTS_SUBMIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "Video id is required" }, { status: 400 });

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
    const video = await submitCreativeScript(id, {
      assigned_creator_name: String(body.assigned_creator_name ?? ""),
      script_text: String(body.script_text ?? ""),
      text_on_screen_suggestion: String(body.text_on_screen_suggestion ?? ""),
      script_brief: String(body.script_brief ?? ""),
      script_brief_attachment_url,
      script_submitted_by_name: (session.fullName || session.email || "").trim(),
      script_submitted_by_id: (session.airtableUserId ?? session.id).trim(),
    });
    return NextResponse.json({ video });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not submit script";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
