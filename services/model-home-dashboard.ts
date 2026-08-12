/**
 * Server loader for Model Home dashboard — reuses existing sync tables / services.
 * Always scoped to the session's linked model record id.
 */

import { getTodayYmdAthens } from "@/lib/airtable-datetime";
import { addDaysAthensYmd } from "@/lib/airtable-datetime";
import {
  buildModelHomeHeroStats,
  buildModelHomeRecentActivity,
  pickUpcomingShoot,
  type ModelHomeActivityItem,
  type ModelHomeEarningsSnapshot,
  type ModelHomeHeroStats,
  type ModelHomeInstagramSnapshot,
  type ModelHomeUpcomingShoot,
} from "@/lib/model-home-dashboard";
import {
  aggregateIgDailyByDate,
  computeModelEngagementRate,
  summarizeIgDaily,
} from "@/lib/instagram-insights-stats";
import { previousPeriodRange, computePctChange } from "@/services/infloww-analytics";
import { deriveModelCreatorAnalytics } from "@/services/infloww-creator-analytics";
import {
  listCreatorDailyStats,
  listCreatorTransactions,
} from "@/services/infloww-creator-earnings";
import { resolveInflowwStatsRange } from "@/services/infloww-performance";
import {
  getClarioSuiteAudienceSnapshot,
  queryClarioSuiteDailyInsights,
  queryClarioSuiteTopPosts,
} from "@/services/clariosuite-sync";
import {
  listClarioSuiteModelAccounts,
  resolvePrimaryIgUserId,
} from "@/services/clariosuite-model-accounts";
import { listCustomRequestsByModel } from "@/services/custom-requests";
import { listFilmingSchedule } from "@/services/filming";
import { listModelLiveStreams } from "@/services/model-live-streams";
import { listModelScheduleItems } from "@/services/model-schedule";
import { listVAContentAssignmentsForModel } from "@/services/va-content-assignments";
import type { ModelRecord } from "@/types";

export type ModelHomeDashboardData = {
  earnings: ModelHomeEarningsSnapshot;
  instagram: ModelHomeInstagramSnapshot;
  upcomingShoot: ModelHomeUpcomingShoot | null;
  hero: ModelHomeHeroStats;
  activity: ModelHomeActivityItem[];
};

async function loadEarningsSnapshot(modelRecordId: string): Promise<{
  snapshot: ModelHomeEarningsSnapshot;
  transactions: Awaited<ReturnType<typeof listCreatorTransactions>>;
  dailyNewSubs: Array<{ date: string; new_subscribers: number }>;
}> {
  const range = resolveInflowwStatsRange("this_month");
  const prev = previousPeriodRange(range.startYmd, range.endYmd);
  const [daily, transactions, prevTxs] = await Promise.all([
    listCreatorDailyStats({
      startYmd: range.startYmd,
      endYmd: range.endYmd,
      modelRecordId,
    }),
    listCreatorTransactions({
      startYmd: range.startYmd,
      endYmd: range.endYmd,
      modelRecordId,
      limit: 200,
    }),
    listCreatorTransactions({
      startYmd: prev.startYmd,
      endYmd: prev.endYmd,
      modelRecordId,
      limit: 200,
    }),
  ]);

  const creatorInflowwId =
    daily[0]?.creator_infloww_id ?? transactions[0]?.creator_infloww_id ?? "";
  const linked = Boolean(creatorInflowwId) || daily.length > 0 || transactions.length > 0;
  const previousGross = prevTxs.reduce((s, t) => s + (t.amount ?? 0), 0);
  const analytics = deriveModelCreatorAnalytics({
    creatorInflowwId: creatorInflowwId || "unlinked",
    modelRecordId,
    modelName: "Model",
    daily,
    transactions,
    refunds: [],
    previousGross,
  });
  const change = analytics.revenue_change ?? computePctChange(analytics.profit.gross, previousGross);
  const latest = daily.length
    ? daily.reduce((a, b) => (a.date >= b.date ? a : b))
    : null;

  return {
    snapshot: {
      linked,
      monthGross: analytics.profit.gross,
      previousGross,
      pctChange: change.pct_change,
      direction: change.direction,
      activeFans: latest?.active_fans ?? null,
    },
    transactions,
    dailyNewSubs: daily.map((d) => ({
      date: d.date,
      new_subscribers: d.new_subscribers ?? 0,
    })),
  };
}

async function loadInstagramSnapshot(
  modelRecord: ModelRecord
): Promise<ModelHomeInstagramSnapshot> {
  const accountRows = await listClarioSuiteModelAccounts(modelRecord.id).catch(() => []);
  const primaryIg = resolvePrimaryIgUserId(modelRecord, accountRows);
  if (!primaryIg) {
    return {
      linked: false,
      followers: null,
      engagementRate: null,
      followerDelta: null,
      topPostThumbUrl: null,
      topPostPermalink: null,
    };
  }

  const range = resolveInflowwStatsRange("this_month");
  const [dailyRaw, audience, topPostsRaw] = await Promise.all([
    queryClarioSuiteDailyInsights({
      modelRecordId: modelRecord.id,
      startYmd: range.startYmd,
      endYmd: range.endYmd,
    }),
    getClarioSuiteAudienceSnapshot({
      modelRecordId: modelRecord.id,
      igUserId: primaryIg,
    }),
    queryClarioSuiteTopPosts({ modelRecordId: modelRecord.id, limit: 3 }),
  ]);

  const daily = aggregateIgDailyByDate(dailyRaw);
  const topPosts = [...topPostsRaw].sort(
    (a, b) => (b.engagement_score ?? -1) - (a.engagement_score ?? -1)
  );

  const totals = summarizeIgDaily(daily);
  const engagementRate = computeModelEngagementRate(daily, topPosts, {
    startYmd: range.startYmd,
    endYmd: range.endYmd,
  });
  const followersRaw = audience?.followers_count;
  const followers =
    followersRaw == null || !Number.isFinite(Number(followersRaw))
      ? totals.follower_end
      : Number(followersRaw);
  const top = topPosts.find((p) => p.image_url) ?? topPosts[0] ?? null;

  return {
    linked: true,
    followers: followers != null && Number.isFinite(followers) ? followers : null,
    engagementRate,
    followerDelta: totals.follower_delta,
    topPostThumbUrl: top?.image_url ?? null,
    topPostPermalink: top?.permalink ?? null,
  };
}

async function loadUpcomingShoot(
  modelRecordId: string,
  stableModelId: string,
  todayYmd: string
): Promise<ModelHomeUpcomingShoot | null> {
  const toDate = addDaysAthensYmd(todayYmd, 90);
  const [filmingByRecord, filmingByStable, scheduleItems] = await Promise.all([
    listFilmingSchedule({
      model_id: modelRecordId,
      fromDate: todayYmd,
      toDate,
    }).catch(() => []),
    stableModelId && stableModelId !== modelRecordId
      ? listFilmingSchedule({
          model_id: stableModelId,
          fromDate: todayYmd,
          toDate,
        }).catch(() => [])
      : Promise.resolve([]),
    listModelScheduleItems(modelRecordId, { fromDate: todayYmd, toDate }).catch(() => []),
  ]);

  const filmingIds = new Set<string>();
  const filming = [...filmingByRecord, ...filmingByStable].filter((e) => {
    if (filmingIds.has(e.id)) return false;
    filmingIds.add(e.id);
    return true;
  });

  const scheduleShoots = scheduleItems.filter((i) => i.item_type === "content_shoot");

  return pickUpcomingShoot({ todayYmd, filming, scheduleShoots });
}

export async function loadModelHomeDashboardData(
  linkedModelId: string,
  modelRecord: ModelRecord
): Promise<ModelHomeDashboardData> {
  const todayYmd = getTodayYmdAthens();
  const lookbackStart = addDaysAthensYmd(todayYmd, -45);

  const [earningsPack, instagram, upcomingShoot, customs, liveStreams, vaAssignments] =
    await Promise.all([
      loadEarningsSnapshot(linkedModelId).catch((err) => {
        console.error("[model-home] earnings snapshot failed", err);
        return {
          snapshot: {
            linked: false,
            monthGross: 0,
            previousGross: 0,
            pctChange: null,
            direction: "na" as const,
            activeFans: null,
          },
          transactions: [],
          dailyNewSubs: [],
        };
      }),
      loadInstagramSnapshot(modelRecord).catch((err) => {
        console.error("[model-home] instagram snapshot failed", err);
        return {
          linked: false,
          followers: null,
          engagementRate: null,
          followerDelta: null,
          topPostThumbUrl: null,
          topPostPermalink: null,
        } satisfies ModelHomeInstagramSnapshot;
      }),
      loadUpcomingShoot(linkedModelId, modelRecord.model_id, todayYmd).catch((err) => {
        console.error("[model-home] upcoming shoot failed", err);
        return null;
      }),
      listCustomRequestsByModel(linkedModelId).catch((err) => {
        console.error("[model-home] customs failed", err);
        return [];
      }),
      listModelLiveStreams(linkedModelId).catch((err) => {
        console.error("[model-home] live streams failed", err);
        return [];
      }),
      listVAContentAssignmentsForModel(linkedModelId, modelRecord.model_id).catch((err) => {
        console.error("[model-home] va assignments failed", err);
        return [];
      }),
    ]);

  // Trim activity sources to recent window where timestamps exist.
  const recentCustoms = customs.filter((c) => {
    const ms = Date.parse(c.updated_at || c.created_at || "");
    if (!Number.isFinite(ms)) return true;
    return ms >= Date.parse(`${lookbackStart}T00:00:00.000Z`);
  });
  const recentLives = liveStreams.slice(0, 25);
  const recentVa = vaAssignments.filter((a) => {
    const st = (a.status ?? "").toLowerCase();
    return st === "completed" || Boolean(a.completed_at);
  });

  const activity = buildModelHomeRecentActivity({
    customs: recentCustoms,
    liveStreams: recentLives,
    transactions: earningsPack.transactions,
    vaAssignments: recentVa,
    upcomingShoot,
    dailyNewSubs: earningsPack.dailyNewSubs,
    limit: 10,
  });

  const earnings = earningsPack.snapshot;
  const hero = buildModelHomeHeroStats({ earnings, instagram, upcomingShoot });

  return { earnings, instagram, upcomingShoot, hero, activity };
}
