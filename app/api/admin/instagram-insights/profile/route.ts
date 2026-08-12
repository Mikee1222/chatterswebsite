import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { isClarioSuiteConfigured, logClarioSuiteFailure } from "@/lib/clariosuite-api";
import { listLinkedClarioSuiteModels } from "@/services/clariosuite-sync";
import { getClarioSuiteProfileSimulator } from "@/services/clariosuite-media-detail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/instagram-insights/profile?modelId=
 * Live ClarioSuite profile + recent media for the Profile Simulator.
 */
export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.INSTAGRAM_INSIGHTS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isClarioSuiteConfigured()) {
    return NextResponse.json({ error: "ClarioSuite API key not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const modelId = url.searchParams.get("modelId")?.trim() || "";
  const igUserIdParam = url.searchParams.get("igUserId")?.trim() || "";
  const linked = await listLinkedClarioSuiteModels();
  const selected =
    (modelId && linked.find((l) => l.modelRecordId === modelId)) || linked[0] || null;
  if (!selected) {
    return NextResponse.json({ error: "No linked Instagram model" }, { status: 404 });
  }

  const igUserId =
    igUserIdParam && selected.accounts.some((a) => a.igUserId === igUserIdParam)
      ? igUserIdParam
      : selected.igUserId;

  try {
    const payload = await getClarioSuiteProfileSimulator(igUserId);
    return NextResponse.json({
      ...payload,
      modelId: selected.modelRecordId,
      modelName: selected.modelName,
    });
  } catch (err) {
    logClarioSuiteFailure("admin profile simulator", err, {
      modelId: selected.modelRecordId,
    });
    const status =
      err && typeof err === "object" && "status" in err && typeof (err as { status: unknown }).status === "number"
        ? (err as { status: number }).status
        : 502;
    const message = err instanceof Error ? err.message : "Failed to load profile";
    return NextResponse.json({ error: message }, { status });
  }
}
