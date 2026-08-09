import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getModelContext } from "@/lib/model-context-server";
import { bestTimeToPostUtc, listClarioSuiteStories } from "@/lib/clariosuite-api";
import {
  buildBestTimeRecommendation,
  warmAudienceSummary,
} from "@/lib/instagram-insights-ui";
import {
  contentTypePerformance,
  followerGrowthRatePct,
  growthMomentum,
  igConsistencyScore,
  pearsonCorrelation,
  postingFrequency,
  postingVsReachSeries,
  priorEqualLengthRange,
  resolveEngagementRate,
  summarizeIgDaily,
} from "@/lib/instagram-insights-stats";
import {
  resolveInflowwStatsRange,
  type InflowwStatsPreset,
} from "@/services/infloww-performance";
import {
  getClarioSuiteAudienceSnapshot,
  queryClarioSuiteDailyInsights,
  queryClarioSuiteTopPosts,
} from "@/services/clariosuite-sync";
import {
  getCrossPlatformAnalytics,
  toModelCrossPlatformCard,
} from "@/services/cross-platform-analytics";

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

/**
 * GET /api/model/instagram-insights
 * Own-model ClarioSuite Instagram insights for the Earnings Instagram tab.
 */
export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { modelRecord, linkedModelId } = await getModelContext();
  if (!linkedModelId || !modelRecord) {
    return NextResponse.json({ error: "Model profile not linked", linked: false }, { status: 404 });
  }

  const igUserId = modelRecord.clariosuite_ig_user_id?.trim() || null;
  if (!igUserId) {
    return NextResponse.json({
      linked: false,
      modelName: modelRecord.model_name,
      range: null,
      daily: [],
      totals: null,
      audience: null,
      audienceSummary: null,
      bestTime: null,
      topPosts: [],
      modelStats: null,
      stories: { active: [], has_metrics: false, error: null },
      crossPlatformCard: null,
      message:
        "Your Instagram account isn’t linked yet. Ask an admin to connect it in Accounts → Models.",
    });
  }

  const url = new URL(request.url);
  const preset = (url.searchParams.get("preset") || "this_month") as InflowwStatsPreset;
  const customFrom = url.searchParams.get("from") ?? undefined;
  const customTo = url.searchParams.get("to") ?? undefined;
  const range = resolveInflowwStatsRange(preset, customFrom, customTo);
  const priorRange = priorEqualLengthRange(range.startYmd, range.endYmd);

  // All queries scoped to this session's modelRecord.id / igUserId only.
  const [daily, priorDaily, audienceRow, topPosts, crossPlatform] = await Promise.all([
    queryClarioSuiteDailyInsights({
      modelRecordId: modelRecord.id,
      startYmd: range.startYmd,
      endYmd: range.endYmd,
    }),
    queryClarioSuiteDailyInsights({
      modelRecordId: modelRecord.id,
      startYmd: priorRange.startYmd,
      endYmd: priorRange.endYmd,
    }),
    getClarioSuiteAudienceSnapshot({ modelRecordId: modelRecord.id }),
    queryClarioSuiteTopPosts({ modelRecordId: modelRecord.id, limit: 25 }),
    getCrossPlatformAnalytics({
      modelRecordId: modelRecord.id,
      modelName: modelRecord.model_name,
      startYmd: range.startYmd,
      endYmd: range.endYmd,
    }),
  ]);
  const crossPlatformCard = toModelCrossPlatformCard(crossPlatform);

  const dailyTotals = summarizeIgDaily(daily);
  const priorTotals = summarizeIgDaily(priorDaily);
  const avgEr = resolveEngagementRate(dailyTotals.avg_engagement_rate, topPosts, {
    startYmd: range.startYmd,
    endYmd: range.endYmd,
  });
  const {
    reach,
    views,
    total_interactions: interactions,
    follower_delta: followerDelta,
    follower_end: followerEnd,
    follower_start: followerStart,
  } = dailyTotals;

  const growthRate = followerGrowthRatePct(followerStart, followerDelta);
  const priorGrowthRate = followerGrowthRatePct(
    priorTotals.follower_start,
    priorTotals.follower_delta
  );
  const freq = postingFrequency(topPosts, range.startYmd, range.endYmd);
  const series = postingVsReachSeries(topPosts, daily, range.startYmd, range.endYmd);
  const corr = pearsonCorrelation(
    series.map((r) => r.posts),
    series.map((r) => r.reach)
  );
  const contentTypes = contentTypePerformance(topPosts);

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
    const { data: storyRows } = await listClarioSuiteStories(igUserId);
    const active = (storyRows ?? []).map((s) => {
      const insight = s.insight;
      const storyReach =
        insight?.reach != null && Number.isFinite(insight.reach) ? Math.round(insight.reach) : null;
      const storyViews =
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
        reach: storyReach,
        views: storyViews,
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
  const ageRanges = asBuckets(audienceRow?.age_ranges);
  const countries = asBuckets(audienceRow?.countries);
  const genderSplit = asBuckets(audienceRow?.gender_split);
  const followersCount =
    audienceRow?.followers_count == null ? null : Number(audienceRow.followers_count);

  const bestRec = buildBestTimeRecommendation(online, {
    topCountryCode: countries[0]?.label ?? null,
    friendly: true,
  });
  const peak = bestTimeToPostUtc(online);

  const audienceSummary = warmAudienceSummary({
    countries,
    ageRanges,
    genders: genderSplit,
    followersCount: Number.isFinite(followersCount) ? followersCount : null,
  });

  return NextResponse.json({
    linked: true,
    modelName: modelRecord.model_name,
    range,
    priorRange,
    daily,
    totals: {
      reach,
      views,
      total_interactions: interactions,
      avg_engagement_rate: avgEr,
      follower_delta: followerDelta,
      follower_end: followerEnd,
      follower_start: followerStart,
    },
    audience: audienceRow
      ? {
          followers_count: Number.isFinite(followersCount) ? followersCount : null,
          age_ranges: ageRanges.slice(0, 6),
          countries: countries.slice(0, 6),
          gender_split: genderSplit,
        }
      : null,
    audienceSummary,
    bestTime: bestRec
      ? {
          hourUtc: bestRec.hourUtc,
          friendlyLabel: bestRec.windowLabel,
          message: bestRec.recommendation,
          peakHourUtc: peak?.hour ?? bestRec.hourUtc,
        }
      : null,
    topPosts,
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
    crossPlatformCard,
  });
}
