import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getSpotChecks } from "@/services/marketing-reviews";
import { getMistakesByVA, getMistakesByChatter } from "@/services/chatter-mistakes";
import {
  AI_FEATURE_KEYS,
  generateSpotMistakePatterns,
} from "@/services/ai-powered-features";
import { getAiFeatureCache, isAiCacheStale } from "@/services/ai-feature-cache";
import { getTodayYmdAthens } from "@/lib/airtable-datetime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function weekCacheKey(subjectKind: string, subjectId: string): string {
  const weekKey = getTodayYmdAthens();
  return `${subjectKind}:${subjectId}:${weekKey.slice(0, 7)}-w${Math.ceil(Number(weekKey.slice(8)) / 7)}`;
}

/**
 * GET/POST /api/admin/ai/spot-mistake-patterns
 * Recurring spot-check + mistake patterns for a VA/chatter profile.
 */
export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canSpot = await hasPermission(session, PERMISSIONS.SPOTCHECK_MANAGE);
  const canMistakes = await hasPermission(session, PERMISSIONS.MISTAKES_VIEW);
  if (!canSpot && !canMistakes) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const subjectId = url.searchParams.get("subjectId")?.trim() || "";
  const subjectKind = (url.searchParams.get("subjectKind")?.trim() || "va") as "va" | "chatter";
  if (!subjectId) return NextResponse.json({ error: "subjectId required" }, { status: 400 });

  const cacheKey = weekCacheKey(subjectKind, subjectId);
  const cached = await getAiFeatureCache(AI_FEATURE_KEYS.SPOT_MISTAKE_PATTERNS, cacheKey);
  if (!cached || isAiCacheStale(cached, WEEK_MS)) {
    return NextResponse.json({ text: null, generated_at: null, cached: false });
  }
  return NextResponse.json({
    text: cached.content_text,
    generated_at: cached.generated_at,
    cached: true,
  });
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canSpot = await hasPermission(session, PERMISSIONS.SPOTCHECK_MANAGE);
  const canMistakes = await hasPermission(session, PERMISSIONS.MISTAKES_VIEW);
  if (!canSpot && !canMistakes) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    subjectId?: string;
    subjectName?: string;
    subjectKind?: "va" | "chatter" | "agency";
    force?: boolean;
  };
  const subjectId = String(body.subjectId ?? "").trim();
  const subjectName = String(body.subjectName ?? "").trim() || "Subject";
  const subjectKind = body.subjectKind === "chatter" || body.subjectKind === "agency" ? body.subjectKind : "va";
  if (!subjectId) return NextResponse.json({ error: "subjectId required" }, { status: 400 });

  try {
    const [spots, mistakes] = await Promise.all([
      canSpot
        ? getSpotChecks({ exec_va_id: subjectId }).catch(() => [])
        : Promise.resolve([]),
      canMistakes
        ? (subjectKind === "chatter"
            ? getMistakesByChatter(subjectId)
            : getMistakesByVA(subjectId)
          ).catch(() => [])
        : Promise.resolve([]),
    ]);

    const spotRows = spots.slice(0, 80).map((s) => ({
      type: s.type,
      status: s.status,
      what_was_wrong: s.what_was_wrong,
      action_taken: s.action_taken,
      creator_name: s.creator_name,
      timestamp: s.timestamp,
    }));

    const mistakeRows = mistakes.slice(0, 80).map((m) => ({
      reason_label: m.reason_label,
      reason_category: m.reason_category,
      status: m.status,
      explanation: m.explanation,
      mistake_date: m.mistake_date,
      model_name: m.model_name,
    }));

    const result = await generateSpotMistakePatterns({
      subjectId,
      subjectName,
      subjectKind,
      spotChecks: spotRows as Array<Record<string, unknown>>,
      mistakes: mistakeRows as Array<Record<string, unknown>>,
      force: Boolean(body.force),
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate patterns";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
