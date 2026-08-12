import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { bestTimeToPostUtc } from "@/lib/clariosuite-api";
import { fetchClarioSuiteStoriesPayload } from "@/lib/instagram-stories-map";
import { buildBestTimeRecommendation } from "@/lib/instagram-insights-ui";
import {
  aggregateIgDailyByDate,
  buildCompareCallouts,
  buildModelComparisonRows,
  computeAgencyAvgEngagementRate,
  computeModelEngagementTotals,
  contentTypePerformance,
  followerGrowthRatePct,
  growthMomentum,
  igConsistencyScore,
  pearsonCorrelation,
  postingFrequency,
  postingVsReachSeries,
  priorEqualLengthRange,
  summarizeIgDaily,
  toFiniteRate,
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
  const igUserIdFilter = url.searchParams.get("igUserId")?.trim() || undefined;

  const range = resolveInflowwStatsRange(preset, customFrom, customTo);
  const priorRange = priorEqualLengthRange(range.startYmd, range.endYmd);
  const linked = await listLinkedClarioSuiteModels();
  const models = linked.map((l) => ({
    id: l.modelRecordId,
    name: l.modelName,
    igUserId: l.igUserId,
    accountCount: l.accounts.length,
    accounts: l.accounts.map((a) => ({
      id: a.accountId,
      igUserId: a.igUserId,
      label: a.label,
      isPrimary: a.isPrimary,
    })),
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

  const selectedIgUserId =
    igUserIdFilter &&
    selected.accounts.some((a) => a.igUserId === igUserIdFilter)
      ? igUserIdFilter
      : undefined;

  const [dailyRaw, audienceRow, topPostsRaw, allDaily, priorDaily, allTopPosts, crossPlatform] =
    await Promise.all([
      queryClarioSuiteDailyInsights({
        modelRecordId: selected.modelRecordId,
        igUserId: selectedIgUserId,
        startYmd: range.startYmd,
        endYmd: range.endYmd,
      }),
      getClarioSuiteAudienceSnapshot({
        modelRecordId: selected.modelRecordId,
        igUserId: selectedIgUserId ?? selected.igUserId,
      }),
      queryClarioSuiteTopPosts({
        modelRecordId: selected.modelRecordId,
        igUserId: selectedIgUserId,
        limit: 25,
      }),
      queryClarioSuiteDailyInsights({
        startYmd: range.startYmd,
        endYmd: range.endYmd,
      }),
      queryClarioSuiteDailyInsights({
        startYmd: priorRange.startYmd,
        endYmd: priorRange.endYmd,
      }),
      Promise.all(
        linked.map(async (m) => {
          const posts: Awaited<ReturnType<typeof queryClarioSuiteTopPosts>> = [];
          for (const a of m.accounts) {
            const chunk = await queryClarioSuiteTopPosts({
              igUserId: a.igUserId,
              limit: 25,
            });
            posts.push(...chunk);
          }
          return {
            modelId: m.modelRecordId,
            igUserId: m.igUserId,
            posts,
          };
        })
      ),
      getCrossPlatformAnalytics({
        modelRecordId: selected.modelRecordId,
        modelName: selected.modelName,
        startYmd: range.startYmd,
        endYmd: range.endYmd,
      }),
    ]);

  const daily = selectedIgUserId ? dailyRaw : aggregateIgDailyByDate(dailyRaw);
  const topPosts = selectedIgUserId
    ? topPostsRaw
    : [...topPostsRaw].sort(
        (a, b) => (b.engagement_score ?? -1) - (a.engagement_score ?? -1)
      );

  const postsByModel = new Map<string, Awaited<ReturnType<typeof queryClarioSuiteTopPosts>>>();
  for (const row of allTopPosts) {
    postsByModel.set(row.modelId, row.posts);
    if (row.igUserId) postsByModel.set(row.igUserId, row.posts);
  }
  const rangeOpts = { startYmd: range.startYmd, endYmd: range.endYmd };
  const totals = computeModelEngagementTotals(daily, topPosts, rangeOpts);
  const linkedForCompare = linked.map((l) => ({
    modelRecordId: l.modelRecordId,
    modelName: l.modelName,
    igUserId: l.igUserId,
    accountCount: l.accounts.length,
  }));
  const comparison = buildModelComparisonRows(
    linkedForCompare,
    allDaily,
    postsByModel,
    rangeOpts
  ).sort((a, b) => b.reach - a.reach);
  const priorComparison = buildModelComparisonRows(linkedForCompare, priorDaily, postsByModel, {
    startYmd: priorRange.startYmd,
    endYmd: priorRange.endYmd,
  });
  const callouts = buildCompareCallouts(comparison, priorComparison);

  const agency = summarizeIgDaily(allDaily);
  const overviewAvgEr = computeAgencyAvgEngagementRate(
    comparison,
    allDaily,
    allTopPosts.flatMap((r) => r.posts),
    rangeOpts
  );
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
    aggregateIgDailyByDate(
      priorDaily.filter((d) => d.model_record_id === selected.modelRecordId)
    )
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
  const contentTypes = contentTypePerformance(topPosts, {
    startYmd: range.startYmd,
    endYmd: range.endYmd,
  });

  // Stories — live list; metrics only if API attaches them
  const stories = await fetchClarioSuiteStoriesPayload(
    selectedIgUserId ?? selected.igUserId
  );

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

  return NextResponse.json(
    {
      range,
      priorRange,
      models,
      selectedModelId: selected.modelRecordId,
      selectedIgUserId: selectedIgUserId ?? null,
      selectedAccountFilter: selectedIgUserId ? "single" : "all",
      igAccounts: selected.accounts.map((a) => ({
        id: a.accountId,
        igUserId: a.igUserId,
        label: a.label,
        isPrimary: a.isPrimary,
      })),
      selectedModelName: selected.modelName,
      linked: true,
      daily,
      totals: {
        ...totals,
        avg_engagement_rate: toFiniteRate(totals.avg_engagement_rate),
      },
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
        avg_engagement_rate: toFiniteRate(overviewAvgEr),
        top_model: topModel
          ? {
              modelId: topModel.modelId,
              modelName: topModel.modelName,
              reach: topModel.reach,
              avg_engagement_rate: toFiniteRate(topModel.avg_engagement_rate),
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
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
