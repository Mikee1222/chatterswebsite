import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  AI_FEATURE_KEYS,
  generateIgInsightsCompare,
  generateIgInsightsModel,
  generateIgInsightsOverview,
} from "@/services/ai-powered-features";
import { getAiFeatureCache, isAiCacheStale } from "@/services/ai-feature-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;

type Surface = "overview" | "by_model" | "compare";

function isSurface(v: string): v is Surface {
  return v === "overview" || v === "by_model" || v === "compare";
}

function featureKeyFor(surface: Surface): string {
  if (surface === "by_model") return AI_FEATURE_KEYS.IG_INSIGHTS_MODEL;
  if (surface === "compare") return AI_FEATURE_KEYS.IG_INSIGHTS_COMPARE;
  return AI_FEATURE_KEYS.IG_INSIGHTS_OVERVIEW;
}

function cacheKeyFor(surface: Surface, startYmd: string, endYmd: string, modelId?: string): string {
  if (surface === "by_model") return `model:${modelId ?? ""}:${startYmd}:${endYmd}`;
  if (surface === "compare") return `compare:${startYmd}:${endYmd}`;
  return `overview:${startYmd}:${endYmd}`;
}

/**
 * GET/POST /api/admin/ai/instagram-insights
 * Surfaces: overview | by_model | compare
 */
export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.INSTAGRAM_INSIGHTS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const surfaceRaw = url.searchParams.get("surface")?.trim() || "overview";
  if (!isSurface(surfaceRaw)) {
    return NextResponse.json({ error: "Invalid surface" }, { status: 400 });
  }
  const startYmd = url.searchParams.get("startYmd")?.trim() || "";
  const endYmd = url.searchParams.get("endYmd")?.trim() || "";
  const modelId = url.searchParams.get("modelId")?.trim() || "";
  if (!startYmd || !endYmd) {
    return NextResponse.json({ error: "startYmd and endYmd required" }, { status: 400 });
  }
  if (surfaceRaw === "by_model" && !modelId) {
    return NextResponse.json({ error: "modelId required" }, { status: 400 });
  }

  const cached = await getAiFeatureCache(
    featureKeyFor(surfaceRaw),
    cacheKeyFor(surfaceRaw, startYmd, endYmd, modelId),
  );
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
  if (!(await hasPermission(session, PERMISSIONS.INSTAGRAM_INSIGHTS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    surface?: string;
    startYmd?: string;
    endYmd?: string;
    modelId?: string;
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
  const modelId = String(body.modelId ?? "").trim();
  const modelName = String(body.modelName ?? "").trim() || "Model";
  const stats =
    body.stats && typeof body.stats === "object" && !Array.isArray(body.stats) ? body.stats : {};

  if (!startYmd || !endYmd) {
    return NextResponse.json({ error: "startYmd and endYmd required" }, { status: 400 });
  }
  if (surfaceRaw === "by_model" && !modelId) {
    return NextResponse.json({ error: "modelId required" }, { status: 400 });
  }

  try {
    const force = Boolean(body.force);
    if (surfaceRaw === "by_model") {
      const result = await generateIgInsightsModel({
        modelId,
        modelName,
        startYmd,
        endYmd,
        stats,
        force,
      });
      return NextResponse.json(result);
    }
    if (surfaceRaw === "compare") {
      const result = await generateIgInsightsCompare({ startYmd, endYmd, stats, force });
      return NextResponse.json(result);
    }
    const result = await generateIgInsightsOverview({ startYmd, endYmd, stats, force });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate insight";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
