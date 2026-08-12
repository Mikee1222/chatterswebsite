import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getModelContext } from "@/lib/model-context-server";
import { isClarioSuiteConfigured, logClarioSuiteFailure } from "@/lib/clariosuite-api";
import { getClarioSuiteProfileSimulator } from "@/services/clariosuite-media-detail";
import {
  listClarioSuiteModelAccounts,
  resolvePrimaryIgUserId,
} from "@/services/clariosuite-model-accounts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/model/instagram-insights/profile?igUserId=
 * Live ClarioSuite profile + recent media for the model Profile Simulator.
 */
export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { modelRecord, linkedModelId } = await getModelContext();
  if (!linkedModelId || !modelRecord) {
    return NextResponse.json({ error: "Model profile not linked" }, { status: 404 });
  }
  const accountRows = await listClarioSuiteModelAccounts(modelRecord.id).catch(() => []);
  const primaryIg = resolvePrimaryIgUserId(modelRecord, accountRows);
  if (!primaryIg) {
    return NextResponse.json({ error: "Instagram not linked" }, { status: 404 });
  }
  if (!isClarioSuiteConfigured()) {
    return NextResponse.json({ error: "ClarioSuite API key not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const igUserIdParam = url.searchParams.get("igUserId")?.trim() || "";
  const igUserId =
    igUserIdParam &&
    accountRows.some((a) => a.clariosuite_ig_user_id === igUserIdParam)
      ? igUserIdParam
      : primaryIg;

  try {
    const payload = await getClarioSuiteProfileSimulator(igUserId);
    return NextResponse.json({
      ...payload,
      modelId: modelRecord.id,
      modelName: modelRecord.model_name,
    });
  } catch (err) {
    logClarioSuiteFailure("model profile simulator", err, { igUserId });
    const status =
      err && typeof err === "object" && "status" in err && typeof (err as { status: unknown }).status === "number"
        ? (err as { status: number }).status
        : 502;
    const message = err instanceof Error ? err.message : "Failed to load profile";
    return NextResponse.json({ error: message }, { status });
  }
}
