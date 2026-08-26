import { NextResponse } from "next/server";
import { requireModelApiContext } from "@/lib/model-api-auth";
import {
  AI_FEATURE_KEYS,
  generateCreatorEarningsModelFacing,
} from "@/services/ai-powered-features";
import { getAiFeatureCache, isAiCacheStale } from "@/services/ai-feature-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * GET/POST /api/model/ai/earnings-insight
 * Model-facing encouraging earnings note (scoped to linked model).
 */
export async function GET(request: Request) {
  const ctx = await requireModelApiContext();
  if (!ctx.ok) return ctx.response;

  const url = new URL(request.url);
  const startYmd = url.searchParams.get("startYmd")?.trim() || "";
  const endYmd = url.searchParams.get("endYmd")?.trim() || "";
  if (!startYmd || !endYmd) {
    return NextResponse.json({ error: "startYmd and endYmd required" }, { status: 400 });
  }

  const cacheKey = `facing:${ctx.linkedModelId}:${startYmd}:${endYmd}`;
  const cached = await getAiFeatureCache(AI_FEATURE_KEYS.CREATOR_EARNINGS_MODEL_FACING, cacheKey);
  if (!cached || isAiCacheStale(cached, DAY_MS)) {
    return NextResponse.json({ text: null, generated_at: null, cached: false });
  }
  return NextResponse.json({
    text: cached.content_text,
    generated_at: cached.generated_at,
    cached: true,
    model: cached.model,
  });
}

export async function POST(request: Request) {
  const ctx = await requireModelApiContext();
  if (!ctx.ok) return ctx.response;

  const body = (await request.json().catch(() => ({}))) as {
    startYmd?: string;
    endYmd?: string;
    modelName?: string;
    stats?: Record<string, unknown>;
    force?: boolean;
  };

  const startYmd = String(body.startYmd ?? "").trim();
  const endYmd = String(body.endYmd ?? "").trim();
  const modelName = String(body.modelName ?? "").trim() || "Your account";
  const stats =
    body.stats && typeof body.stats === "object" && !Array.isArray(body.stats) ? body.stats : {};

  if (!startYmd || !endYmd) {
    return NextResponse.json({ error: "startYmd and endYmd required" }, { status: 400 });
  }

  try {
    const result = await generateCreatorEarningsModelFacing({
      modelId: ctx.linkedModelId,
      modelName,
      startYmd,
      endYmd,
      stats,
      force: Boolean(body.force),
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate insight";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
