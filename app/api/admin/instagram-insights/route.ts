import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { bestTimeToPostUtc } from "@/lib/clariosuite-api";
import { buildBestTimeRecommendation } from "@/lib/instagram-insights-ui";
import {
  resolveInflowwStatsRange,
  type InflowwStatsPreset,
} from "@/services/infloww-performance";
import {
  getClarioSuiteAudienceSnapshot,
  listLinkedClarioSuiteModels,
  queryClarioSuiteDailyInsights,
  queryClarioSuiteTopPosts,
} from "@/services/clariosuite-sync";
import { getCrossPlatformAnalytics } from "@/services/cross-platform-analytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DemoBucket = { label: string; value: number };

function asBuckets(v: unknown): DemoBucket[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const label = typeof o.label === "string" ? o.label : String(o.label ?? "");
      const value = typeof o.value === "number" ? o.value : Number(o.value);
      if (!label || !Number.isFinite(value)) return null;
      return { label, value };
    })
    .filter((x): x is DemoBucket => Boolean(x));
}

function asOnlineHours(v: unknown): Array<{ hour: number; value: number }> {
  if (!Array.isArray(v)) return [];
  return v
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const hour = typeof o.hour === "number" ? o.hour : Number(o.hour);
      const value = typeof o.value === "number" ? o.value : Number(o.value);
      if (!Number.isFinite(hour) || !Number.isFinite(value)) return null;
      return { hour, value };
    })
    .filter((x): x is { hour: number; value: number } => Boolean(x));
}

function summarizeDaily(
  daily: Array<{
    reach: number;
    views: number;
    total_interactions: number;
    follower_count: number | null;
    engagement_rate: number | null;
  }>
) {
  const reach = daily.reduce((s, d) => s + d.reach, 0);
  const views = daily.reduce((s, d) => s + d.views, 0);
  const interactions = daily.reduce((s, d) => s + d.total_interactions, 0);
  const erDays = daily.filter((d) => d.engagement_rate != null);
  const avgEr =
    erDays.length > 0
      ? erDays.reduce((s, d) => s + (d.engagement_rate ?? 0), 0) / erDays.length
      : reach > 0
        ? (interactions / reach) * 100
        : null;
  const withFollowers = daily.filter((d) => d.follower_count != null);
  const followerStart = withFollowers[0]?.follower_count ?? null;
  const followerEnd = withFollowers[withFollowers.length - 1]?.follower_count ?? null;
  const followerDelta =
    followerStart != null && followerEnd != null ? followerEnd - followerStart : null;
  return {
    reach,
    views,
    total_interactions: interactions,
    avg_engagement_rate: avgEr,
    follower_start: followerStart,
    follower_end: followerEnd,
    follower_delta: followerDelta,
  };
}

/**
 * GET /api/admin/instagram-insights
 * Aggregated ClarioSuite insights for admin Marketing dashboard.
 */
export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.INSTAGRAM_INSIGHTS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const preset = (url.searchParams.get("preset") || "this_month") as InflowwStatsPreset;
  const customFrom = url.searchParams.get("from") ?? undefined;
  const customTo = url.searchParams.get("to") ?? undefined;
  const modelRecordId = url.searchParams.get("modelId")?.trim() || undefined;

  const range = resolveInflowwStatsRange(preset, customFrom, customTo);
  const linked = await listLinkedClarioSuiteModels();
  const models = linked.map((l) => ({
    id: l.modelRecordId,
    name: l.modelName,
    igUserId: l.igUserId,
  }));

  if (!models.length) {
    return NextResponse.json({
      range,
      models,
      selectedModelId: null,
      linked: false,
      daily: [],
      totals: {
        reach: 0,
        views: 0,
        total_interactions: 0,
        avg_engagement_rate: null,
        follower_start: null,
        follower_end: null,
        follower_delta: null,
      },
      audience: null,
      bestTime: null,
      topPosts: [],
      comparison: [],
      lastSyncedAt: null,
      crossPlatform: null,
    });
  }

  const selected =
    (modelRecordId && linked.find((l) => l.modelRecordId === modelRecordId)) || linked[0]!;

  const [daily, audienceRow, topPosts, allDaily, crossPlatform] = await Promise.all([
    queryClarioSuiteDailyInsights({
      modelRecordId: selected.modelRecordId,
      startYmd: range.startYmd,
      endYmd: range.endYmd,
    }),
    getClarioSuiteAudienceSnapshot({ modelRecordId: selected.modelRecordId }),
    queryClarioSuiteTopPosts({ modelRecordId: selected.modelRecordId, limit: 25 }),
    queryClarioSuiteDailyInsights({
      startYmd: range.startYmd,
      endYmd: range.endYmd,
    }),
    getCrossPlatformAnalytics({
      modelRecordId: selected.modelRecordId,
      modelName: selected.modelName,
      startYmd: range.startYmd,
      endYmd: range.endYmd,
    }),
  ]);

  const totals = summarizeDaily(daily);

  const byModel = new Map<
    string,
    {
      modelId: string;
      modelName: string;
      rows: typeof allDaily;
    }
  >();
  for (const m of linked) {
    byModel.set(m.modelRecordId, {
      modelId: m.modelRecordId,
      modelName: m.modelName,
      rows: [],
    });
  }
  for (const row of allDaily) {
    const id = row.model_record_id;
    if (!id || !byModel.has(id)) continue;
    byModel.get(id)!.rows.push(row);
  }
  const comparison = [...byModel.values()]
    .map((m) => {
      const s = summarizeDaily(m.rows);
      return {
        modelId: m.modelId,
        modelName: m.modelName,
        reach: s.reach,
        views: s.views,
        avg_engagement_rate: s.avg_engagement_rate,
        follower_delta: s.follower_delta,
        days: m.rows.length,
      };
    })
    .sort((a, b) => b.reach - a.reach);

  const online = asOnlineHours(audienceRow?.online_followers_by_hour);
  const countries = asBuckets(audienceRow?.countries);
  const topCountry = countries[0]?.label ?? null;
  const peak = bestTimeToPostUtc(online);
  const bestRec = buildBestTimeRecommendation(online, {
    topCountryCode: topCountry,
    modelName: selected.modelName,
  });

  const lastSyncedAt =
    (typeof audienceRow?.synced_at === "string" ? audienceRow.synced_at : null) ||
    (topPosts.length && typeof (topPosts[0] as { synced_at?: string }).synced_at === "string"
      ? (topPosts[0] as { synced_at?: string }).synced_at!
      : null);

  return NextResponse.json({
    range,
    models,
    selectedModelId: selected.modelRecordId,
    selectedIgUserId: selected.igUserId,
    selectedModelName: selected.modelName,
    linked: true,
    daily,
    totals,
    audience: audienceRow
      ? {
          followers_count: audienceRow.followers_count ?? null,
          age_ranges: asBuckets(audienceRow.age_ranges),
          countries,
          gender_split: asBuckets(audienceRow.gender_split),
          online_followers_by_hour: online,
          synced_at: audienceRow.synced_at ?? null,
        }
      : null,
    bestTime: bestRec
      ? {
          hourUtc: bestRec.hourUtc,
          value: bestRec.value,
          label: bestRec.windowLabel,
          recommendation: bestRec.recommendation,
          athensHint: bestRec.athensHint,
          peakHourUtc: peak?.hour ?? bestRec.hourUtc,
        }
      : null,
    topPosts,
    comparison,
    lastSyncedAt,
    crossPlatform,
  });
}
