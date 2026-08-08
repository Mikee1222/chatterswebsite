import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getModelContext } from "@/lib/model-context-server";
import { isClarioSuiteConfigured, logClarioSuiteFailure } from "@/lib/clariosuite-api";
import { getClarioSuiteMediaDetail } from "@/services/clariosuite-media-detail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/model/instagram-insights/media/:mediaId
 * Lazy live ClarioSuite per-media insights for the signed-in model.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ mediaId: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { modelRecord, linkedModelId } = await getModelContext();
  if (!linkedModelId || !modelRecord) {
    return NextResponse.json({ error: "Model profile not linked" }, { status: 404 });
  }
  const igUserId = modelRecord.clariosuite_ig_user_id?.trim() || null;
  if (!igUserId) {
    return NextResponse.json({ error: "Instagram not linked" }, { status: 404 });
  }
  if (!isClarioSuiteConfigured()) {
    return NextResponse.json({ error: "ClarioSuite API key not configured" }, { status: 503 });
  }

  const { mediaId: rawId } = await ctx.params;
  const mediaId = decodeURIComponent(rawId || "").trim();
  if (!mediaId) return NextResponse.json({ error: "mediaId required" }, { status: 400 });

  try {
    const detail = await getClarioSuiteMediaDetail({
      igUserId,
      mediaId,
      modelRecordId: modelRecord.id,
    });
    return NextResponse.json(detail);
  } catch (err) {
    logClarioSuiteFailure("model media detail", err, { mediaId, igUserId });
    const message = err instanceof Error ? err.message : "Failed to load media insights";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
