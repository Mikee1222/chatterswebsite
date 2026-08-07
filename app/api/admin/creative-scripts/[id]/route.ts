import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  approveCreativeScript,
  rejectCreativeScript,
  saveCreativeScriptText,
} from "@/services/winner-videos";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CREATIVE_SCRIPTS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = (await req.json()) as Record<string, unknown>;
  const action = String(body.action ?? "").trim();
  const reviewerName = (session.fullName || session.email || "").trim();
  const script_text = String(body.script_text ?? "");
  const text_on_screen_suggestion =
    body.text_on_screen_suggestion !== undefined
      ? String(body.text_on_screen_suggestion)
      : undefined;
  const script_brief =
    body.script_brief !== undefined ? String(body.script_brief) : undefined;

  try {
    if (action === "save") {
      const video = await saveCreativeScriptText(id, script_text, text_on_screen_suggestion, script_brief);
      return NextResponse.json({ video });
    }

    if (action === "approve") {
      const video = await approveCreativeScript(id, {
        script_text,
        text_on_screen_suggestion,
        script_brief,
        reviewed_by_name: reviewerName,
      });
      return NextResponse.json({ video });
    }

    if (action === "reject") {
      const video = await rejectCreativeScript(id, {
        script_text,
        text_on_screen_suggestion,
        script_brief,
        reviewed_by_name: reviewerName,
        script_rejection_reason: String(body.script_rejection_reason ?? ""),
      });
      return NextResponse.json({ video });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update script";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
