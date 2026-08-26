import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  AI_FEATURE_KEYS,
  generateCreatorEarningsModel,
  generateCreatorEarningsOverview,
} from "@/services/ai-powered-features";
import { getAiFeatureCache, isAiCacheStale } from "@/services/ai-feature-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;

type Surface = "overview" | "model";

function isSurface(v: string): v is Surface {
  return v === "overview" || v === "model";
}

/**
 * GET/POST /api/admin/ai/creator-earnings
 * Surfaces: overview | model
 */
export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.EARNINGS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const surfaceRaw = url.searchParams.get("surface")?.trim() || "overview";
  if (!isSurface(surfaceRaw)) {
    return NextResponse.json({ error: "Invalid surface" }, { status: 400 });
  }
  const startYmd = url.searchParams.get("startYmd")?.trim() || "";
  const endYmd = url.searchParams.get("endYmd")?.trim() || "";
  const modelKey = url.searchParams.get("modelKey")?.trim() || "";
  if (!startYmd || !endYmd) {
    return NextResponse.json({ error: "startYmd and endYmd required" }, { status: 400 });
  }
  if (surfaceRaw === "model" && !modelKey) {
    return NextResponse.json({ error: "modelKey required" }, { status: 400 });
  }

  const featureKey =
    surfaceRaw === "model"
      ? AI_FEATURE_KEYS.CREATOR_EARNINGS_MODEL
      : AI_FEATURE_KEYS.CREATOR_EARNINGS_OVERVIEW;
  const cacheKey =
    surfaceRaw === "model"
      ? `model:${modelKey}:${startYmd}:${endYmd}`
      : `overview:${startYmd}:${endYmd}`;

  const cached = await getAiFeatureCache(featureKey, cacheKey);
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
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.EARNINGS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    surface?: string;
    startYmd?: string;
    endYmd?: string;
    modelKey?: string;
    modelName?: string;
    stats?: Record<string, unknown>;
    force?: boolean;
  };

  const surfaceRaw = String(body.surface ?? "overview").trim();
  if (!isSurface(surfaceRaw)) {
    return NextResponse.json({ error: "Invalid surface" }, { status: 400 });
  }
  const startYmd = String(body.startYmd ?? "").trim();
  const endYmd = String(body.endYmd ?? "").trim();
  const modelKey = String(body.modelKey ?? "").trim();
  const modelName = String(body.modelName ?? "").trim() || "Model";
  const stats =
    body.stats && typeof body.stats === "object" && !Array.isArray(body.stats) ? body.stats : {};

  if (!startYmd || !endYmd) {
    return NextResponse.json({ error: "startYmd and endYmd required" }, { status: 400 });
  }
  if (surfaceRaw === "model" && !modelKey) {
    return NextResponse.json({ error: "modelKey required" }, { status: 400 });
  }

  try {
    const force = Boolean(body.force);
    if (surfaceRaw === "model") {
      const result = await generateCreatorEarningsModel({
        modelKey,
        modelName,
        startYmd,
        endYmd,
        stats,
        force,
      });
      return NextResponse.json(result);
    }
    const result = await generateCreatorEarningsOverview({ startYmd, endYmd, stats, force });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate insight";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
