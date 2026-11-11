import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getWinnerVideoById } from "@/services/winner-videos";
import { draftScriptFromBreakdown } from "@/services/script-from-breakdown";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/creative-scripts/[id]/draft-from-breakdown  { breakdownId, modelId }
 * Writes the script idea block (original [GRID] + 2 variations [TRIAL]) for one slot
 * from a Winner Breakdown of its reference video. Returns text for the form; saves nothing.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [canSubmit, canManage, canStudio] = await Promise.all([
    hasPermission(session, PERMISSIONS.CREATIVE_SCRIPTS_SUBMIT),
    hasPermission(session, PERMISSIONS.CREATIVE_SCRIPTS_MANAGE),
    hasPermission(session, PERMISSIONS.CREATIVE_STUDIO_USE),
  ]);
  if ((!canSubmit && !canManage) || !canStudio) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    breakdownId?: string;
    modelId?: string;
  };
  const breakdownId = String(body.breakdownId ?? "").trim();
  const modelId = String(body.modelId ?? "").trim();
  if (!breakdownId || !modelId) {
    return NextResponse.json({ error: "breakdownId and modelId are required" }, { status: 400 });
  }

  try {
    const video = await getWinnerVideoById(id);
    if (!video) return NextResponse.json({ error: "Script item not found" }, { status: 404 });
    const result = await draftScriptFromBreakdown({
      breakdownId,
      modelId,
      videoType: video.sourcing_video_type || video.script_video_type || undefined,
      adminInstructions: video.admin_instructions || undefined,
      userId: session.airtableUserId ?? session.id,
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not write the script";
    return NextResponse.json({ error: msg }, { status: msg.includes("Rate limit") ? 429 : 502 });
  }
}
