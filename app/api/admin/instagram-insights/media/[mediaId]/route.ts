import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { isClarioSuiteConfigured, logClarioSuiteFailure } from "@/lib/clariosuite-api";
import { listLinkedClarioSuiteModels } from "@/services/clariosuite-sync";
import { getClarioSuiteMediaDetail } from "@/services/clariosuite-media-detail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/instagram-insights/media/:mediaId?modelId=
 * Lazy live ClarioSuite per-media insights + carousel children.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ mediaId: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.INSTAGRAM_INSIGHTS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isClarioSuiteConfigured()) {
    return NextResponse.json({ error: "ClarioSuite API key not configured" }, { status: 503 });
  }

  const { mediaId: rawId } = await ctx.params;
  const mediaId = decodeURIComponent(rawId || "").trim();
  if (!mediaId) return NextResponse.json({ error: "mediaId required" }, { status: 400 });

  const url = new URL(request.url);
  const modelId = url.searchParams.get("modelId")?.trim() || "";
  const linked = await listLinkedClarioSuiteModels();
  const selected =
    (modelId && linked.find((l) => l.modelRecordId === modelId)) || linked[0] || null;
  if (!selected) {
    return NextResponse.json({ error: "No linked Instagram model" }, { status: 404 });
  }

  try {
    const detail = await getClarioSuiteMediaDetail({
      igUserId: selected.igUserId,
      mediaId,
      modelRecordId: selected.modelRecordId,
    });
    return NextResponse.json(detail);
  } catch (err) {
    logClarioSuiteFailure("admin media detail", err, {
      mediaId,
      modelId: selected.modelRecordId,
    });
    const message = err instanceof Error ? err.message : "Failed to load media insights";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
