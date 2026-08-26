import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { isAdminAreaUser } from "@/lib/rbac";
import { getTodayYmdAthens } from "@/lib/airtable-datetime";
import {
  AI_FEATURE_KEYS,
  generateAdminHomeBriefing,
} from "@/services/ai-powered-features";
import { getAiFeatureCache, isAiCacheStale } from "@/services/ai-feature-cache";
import {
  buildAdminHomeBriefingSignals,
  type AdminHomeClientMetrics,
} from "@/services/admin-home-briefing-signals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * GET /api/admin/ai/home-briefing — cached briefing for today (if any).
 * POST — generate (or refresh with force) using ops signals + client home metrics.
 */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminAreaUser(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cacheKey = getTodayYmdAthens();
  const cached = await getAiFeatureCache(AI_FEATURE_KEYS.ADMIN_HOME_BRIEFING, cacheKey);
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
  if (!isAdminAreaUser(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as AdminHomeClientMetrics & {
    force?: boolean;
  };

  try {
    const signals = await buildAdminHomeBriefingSignals(body);
    const result = await generateAdminHomeBriefing(signals, { force: Boolean(body.force) });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate briefing";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
