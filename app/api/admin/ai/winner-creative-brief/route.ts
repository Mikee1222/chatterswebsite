import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { generateWinnerVideoCreativeBrief } from "@/services/ai-powered-features";
import {
  getWinnerVideoById,
  saveScriptBriefOnly,
} from "@/services/winner-videos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/admin/ai/winner-creative-brief
 * Generate + optionally save a starting script_brief for an approved winner video.
 */
export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.WINNER_VIDEOS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    videoId?: string;
    save?: boolean;
  };
  const videoId = String(body.videoId ?? "").trim();
  if (!videoId) return NextResponse.json({ error: "videoId required" }, { status: 400 });

  const video = await getWinnerVideoById(videoId);
  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const brief = await generateWinnerVideoCreativeBrief({
      caption: video.note,
      adminInstructions: video.admin_instructions,
      qualityRating: video.quality_rating ?? undefined,
      modelName: video.reference_model_name || video.assigned_creator_name,
      researchNotes: video.note,
    });
    if (body.save !== false) {
      await saveScriptBriefOnly(videoId, brief);
    }
    return NextResponse.json({ brief });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate brief";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
