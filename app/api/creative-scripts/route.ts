import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { submitCreativeScript } from "@/services/winner-videos";
import { SCRIPT_VIDEO_TYPES, type ScriptVideoType } from "@/lib/creative-scripts-helpers";

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CREATIVE_SCRIPTS_SUBMIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "Video id is required" }, { status: 400 });

  const script_video_type = String(body.script_video_type ?? "").trim() as ScriptVideoType;
  if (!(SCRIPT_VIDEO_TYPES as readonly string[]).includes(script_video_type)) {
    return NextResponse.json({ error: "Valid script type is required" }, { status: 400 });
  }

  try {
    const video = await submitCreativeScript(id, {
      assigned_creator_name: String(body.assigned_creator_name ?? ""),
      script_video_type,
      script_text: String(body.script_text ?? ""),
      text_on_screen_suggestion: String(body.text_on_screen_suggestion ?? ""),
      script_submitted_by_name: (session.fullName || session.email || "").trim(),
      script_submitted_by_id: (session.airtableUserId ?? session.id).trim(),
    });
    return NextResponse.json({ video });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not submit script";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
