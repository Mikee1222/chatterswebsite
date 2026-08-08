import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { bestTimeToPostUtc, listClarioSuiteStories } from "@/lib/clariosuite-api";
import { buildBestTimeRecommendation } from "@/lib/instagram-insights-ui";
import {
  buildCompareCallouts,
  contentTypePerformance,
  followerGrowthRatePct,
  growthMomentum,
  igConsistencyScore,
  pearsonCorrelation,
  postingFrequency,
  postingVsReachSeries,
  priorEqualLengthRange,
  summarizeIgDaily,
} from "@/lib/instagram-insights-stats";
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

type LinkedModel = Awaited<ReturnType<typeof listLinkedClarioSuiteModels>>[number];
type DailyRow = Awaited<ReturnType<typeof queryClarioSuiteDailyInsights>>[number];
type PostRow = Awaited<ReturnType<typeof queryClarioSuiteTopPosts>>[number];

function buildComparisonRows(
  linked: LinkedModel[],
  allDaily: DailyRow[],
  postsByModel: Map<string, PostRow[]>
) {
  const byModel = new Map<string, { modelId: string; modelName: string; rows: DailyRow[] }>();
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

  return [...byModel.values()].map((m) => {
    const s = summarizeIgDaily(m.rows);
    const posts = postsByModel.get(m.modelId) ?? [];
    const topEng =
      posts.reduce<number | null>((best, p) => {
        if (p.engagement_score == null) return best;
        if (best == null || p.engagement_score > best) return p.engagement_score;
        return best;
      }, null) ?? null;
    const growthRate = followerGrowthRatePct(s.follower_start, s.follower_delta);
    return {
      modelId: m.modelId,
      modelName: m.modelName,
      reach: s.reach,
      views: s.views,
      avg_engagement_rate: s.avg_engagement_rate,
      follower_start: s.follower_start,
      follower_end: s.follower_end,
      follower_delta: s.follower_delta,
      growth_rate_pct: growthRate,
      top_post_engagement: topEng,
      consistency_score: igConsistencyScore(m.rows),
      days: m.rows.length,
    };
  });
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
  const priorRange = priorEqualLengthRange(range.startYmd, range.endYmd);
  const linked = await listLinkedClarioSuiteModels();
  const models = linked.map((l) => ({
    id: l.modelRecordId,
    name: l.modelName,
    igUserId: l.igUserId,
  }));

  const emptyTotals = {
    reach: 0,
    views: 0,
    total_interactions: 0,
    avg_engagement_rate: null as number | null,
    follower_start: null as number | null,
    follower_end: null as number | null,
    follower_delta: null as number | null,
  };

  if (!models.length) {
    return NextResponse.json({
      range,
      priorRange,
      models,
      selectedModelId: null,
      linked: false,
      daily: [],
      totals: emptyTotals,
      audience: null,
      bestTime: null,
      topPosts: [],
      comparison: [],
      priorComparison: [],
      callouts: [],
      overview: {
        total_reach: 0,
        total_followers: null,
        avg_engagement_rate: null,
        top_model: null,
        models_with_data: 0,
      },
      modelStats: null,
      stories: { active: [], has_metrics: false, error: null },
      lastSyncedAt: null,
      crossPlatform: null,
    });
  }

  const selected =
    (modelRecordId && linked.find((l) => l.modelRecordId === modelRecordId)) || linked[0]!;

  const [daily, audienceRow, topPosts, allDaily, priorDaily, allTopPosts, crossPlatform] =
    await Promise.all([
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
      queryClarioSuiteDailyInsights({
        startYmd: priorRange.startYmd,
        endYmd: priorRange.endYmd,
      }),
      Promise.all(
        linked.map(async (m) => ({
          modelId: m.modelRecordId,
          posts: await queryClarioSuiteTopPosts({ modelRecordId: m.modelRecordId, limit: 25 }),
        }))
      ),
      getCrossPlatformAnalytics({
        modelRecordId: selected.modelRecordId,
        modelName: selected.modelName,
        startYmd: range.startYmd,
        endYmd: range.endYmd,
      }),
    ]);

  const postsByModel = new Map(allTopPosts.map((r) => [r.modelId, r.posts]));
  const totals = summarizeIgDaily(daily);
  const comparison = buildComparisonRows(linked, allDaily, postsByModel).sort(
    (a, b) => b.reach - a.reach
  );
  const priorComparison = buildComparisonRows(linked, priorDaily, postsByModel);
  const callouts = buildCompareCallouts(comparison, priorComparison);

  // Agency overview
  const agency = summarizeIgDaily(allDaily);
  const erModels = comparison.filter((c) => c.avg_engagement_rate != null);
  const overviewAvgEr =
    erModels.length > 0
      ? erModels.reduce((s, c) => s + (c.avg_engagement_rate ?? 0), 0) / erModels.length
      : agency.avg_engagement_rate;
  const totalFollowers = comparison.reduce((s, c) => s + (c.follower_end ?? 0), 0);
  const hasFollowerEnds = comparison.some((c) => c.follower_end != null);
  const topModel =
    [...comparison].sort((a, b) => {
      const ae = a.avg_engagement_rate ?? -1;
      const be = b.avg_engagement_rate ?? -1;
      if (be !== ae) return be - ae;
      return b.reach - a.reach;
    })[0] ?? null;

  // Selected-model extras
  const priorSelected = summarizeIgDaily(
    priorDaily.filter((d) => d.model_record_id === selected.modelRecordId)
  );
  const growthRate = followerGrowthRatePct(totals.follower_start, totals.follower_delta);
  const priorGrowthRate = followerGrowthRatePct(
    priorSelected.follower_start,
    priorSelected.follower_delta
  );
  const freq = postingFrequency(topPosts, range.startYmd, range.endYmd);
  const series = postingVsReachSeries(topPosts, daily, range.startYmd, range.endYmd);
  const corr = pearsonCorrelation(
    series.map((r) => r.posts),
    series.map((r) => r.reach)
  );
  const contentTypes = contentTypePerformance(topPosts);

  // Stories — live list; metrics only if API attaches them
  let stories: {
    active: Array<{
      id: string;
      media_type: string | null;
      permalink: string | null;
      image_url: string | null;
      posted_at: string | null;
      reach: number | null;
      views: number | null;
    }>;
    has_metrics: boolean;
    error: string | null;
  } = { active: [], has_metrics: false, error: null };
  try {
    const { data: storyRows } = await listClarioSuiteStories(selected.igUserId);
    const active = (storyRows ?? []).map((s) => {
      const insight = s.insight;
      const reach =
        insight?.reach != null && Number.isFinite(insight.reach) ? Math.round(insight.reach) : null;
      const views =
        insight?.views != null && Number.isFinite(insight.views)
          ? Math.round(insight.views)
          : insight?.videoViews != null && Number.isFinite(insight.videoViews)
            ? Math.round(insight.videoViews)
            : null;
      return {
        id: String(s.id),
        media_type: s.mediaType ?? null,
        permalink: s.permalink ?? null,
        image_url: s.imageUrl || null,
        posted_at: s.timestamp || null,
        reach,
        views,
      };
    });
    stories = {
      active,
      has_metrics: active.some((a) => a.reach != null || a.views != null),
      error: null,
    };
  } catch (err) {
    stories = {
      active: [],
      has_metrics: false,
      error: err instanceof Error ? err.message : "Stories unavailable",
    };
  }

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
    priorRange,
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
    priorComparison,
    callouts,
    overview: {
      total_reach: agency.reach,
      total_views: agency.views,
      total_interactions: agency.total_interactions,
      total_followers: hasFollowerEnds ? totalFollowers : audienceRow?.followers_count ?? null,
      avg_engagement_rate: overviewAvgEr,
      top_model: topModel
        ? {
            modelId: topModel.modelId,
            modelName: topModel.modelName,
            reach: topModel.reach,
            avg_engagement_rate: topModel.avg_engagement_rate,
            follower_delta: topModel.follower_delta,
          }
        : null,
      models_with_data: comparison.filter((c) => c.days > 0).length,
    },
    modelStats: {
      growth_rate_pct: growthRate,
      prior_growth_rate_pct: priorGrowthRate,
      growth_momentum: growthMomentum(growthRate, priorGrowthRate),
      consistency_score: igConsistencyScore(daily),
      posting_frequency: freq,
      posting_vs_reach: series,
      posting_reach_correlation: corr,
      content_type_performance: contentTypes,
    },
    stories,
    lastSyncedAt,
    crossPlatform,
  });
}
