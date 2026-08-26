import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  AI_FEATURE_KEYS,
  generateChatterPerfDetail,
} from "@/services/ai-powered-features";
import { getAiFeatureCache, isAiCacheStale } from "@/services/ai-feature-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * GET/POST /api/infloww-stats/ai-insight
 * Chatter "My Performance" coaching note (own stats only).
 */
export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.INFLOWW_STATS_VIEW_OWN))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const startYmd = url.searchParams.get("startYmd")?.trim() || "";
  const endYmd = url.searchParams.get("endYmd")?.trim() || "";
  if (!startYmd || !endYmd) {
    return NextResponse.json({ error: "startYmd and endYmd required" }, { status: 400 });
  }

  const cacheKey = `detail:own:${session.id}:${startYmd}:${endYmd}`;
  const cached = await getAiFeatureCache(AI_FEATURE_KEYS.CHATTER_PERF_DETAIL, cacheKey);
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
  if (!(await hasPermission(session, PERMISSIONS.INFLOWW_STATS_VIEW_OWN))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    startYmd?: string;
    endYmd?: string;
    chatterName?: string;
    stats?: Record<string, unknown>;
    force?: boolean;
  };

  const startYmd = String(body.startYmd ?? "").trim();
  const endYmd = String(body.endYmd ?? "").trim();
  const chatterName =
    String(body.chatterName ?? "").trim() || session.fullName?.trim() || "You";
  const stats =
    body.stats && typeof body.stats === "object" && !Array.isArray(body.stats) ? body.stats : {};

  if (!startYmd || !endYmd) {
    return NextResponse.json({ error: "startYmd and endYmd required" }, { status: 400 });
  }

  try {
    const result = await generateChatterPerfDetail({
      chatterId: session.id,
      chatterName,
      startYmd,
      endYmd,
      stats,
      audience: "chatter",
      force: Boolean(body.force),
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate insight";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
