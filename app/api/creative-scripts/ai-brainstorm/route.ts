import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { brainstormCreativeScript } from "@/services/ai-powered-features";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/creative-scripts/ai-brainstorm
 */
export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canSubmit = await hasPermission(session, PERMISSIONS.CREATIVE_SCRIPTS_SUBMIT);
  const canManage = await hasPermission(session, PERMISSIONS.CREATIVE_SCRIPTS_MANAGE);
  if (!canSubmit && !canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    draftScript?: string;
    brief?: string;
    caption?: string;
    videoType?: string;
    modelName?: string;
  };

  try {
    const suggestions = await brainstormCreativeScript({
      draftScript: String(body.draftScript ?? ""),
      brief: body.brief,
      caption: body.caption,
      videoType: body.videoType,
      modelName: body.modelName,
    });
    return NextResponse.json({ suggestions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Brainstorm failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
