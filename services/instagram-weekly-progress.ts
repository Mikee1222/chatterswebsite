/**
 * Instagram Insights — custom 4-week/month breakdown per linked model.
 * Mirrors Chatter Performance Weekly Progress (`services/infloww-performance.ts`).
 */

import { addDaysAthensYmd, getTodayYmdAthens, ymdInAthens } from "@/lib/airtable-datetime";
import {
  classifyCustomWeekProgress,
  customWeekIndexForYmd,
  formatCustomWeekDisplayLabel,
  getCustomWeekBoundaries,
  type CustomWeekBoundary,
  type CustomWeekIndex,
  type CustomWeekProgress,
  type CustomWeekStatus,
} from "@/lib/infloww-custom-weeks";
import { classifyIgPost, igPostGroupLabel } from "@/lib/instagram-insights-ui";
import {
  generateIgWeeklyInsights,
  generateIgWeeklyTalkingPoints,
  igGuardedPeriodChange,
  medianIgMetric,
  pctVsBaseline,
  type IgWeeklyInsightTag,
} from "@/lib/instagram-weekly-insights";
import type { PeriodChangeDisplayNote } from "@/services/infloww-analytics";
import {
  aggregateIgDailyByDate,
  computeModelEngagementTotals,
  followerGrowthRatePct,
  pearsonCorrelation,
  postingFrequency,
  postingVsReachSeries,
  resolvePostEngagementScore,
  resolvePostReach,
  toFiniteRate,
  type IgDailyRow,
  type IgPostRow,
} from "@/lib/instagram-insights-stats";
import {
  type PeriodChangeMetric,
  previousPeriodRange,
} from "@/services/infloww-analytics";
import {
  deriveCrossPlatformAnalytics,
  type CrossPlatformAnalytics,
} from "@/services/cross-platform-analytics";
import {
  listLinkedClarioSuiteModels,
  queryClarioSuiteDailyInsights,
  queryClarioSuiteTopPostsForModels,
  type ClarioSuiteTopPostRow,
} from "@/services/clariosuite-sync";
import {
  creatorTxRevenueAmount,
  filterCreatorTransactionsInAthensYmdRange,
  listCreatorDailyStats,
  listCreatorRevenueByAthensDay,
  sumCreatorTxRevenue,
  syntheticCreatorTxFromDailyRevenue,
  type CreatorDailyStatsRow,
  type CreatorTransactionRow,
} from "@/services/infloww-creator-earnings";

export type IgWeekMetricTotals = {
  reach: number;
  views: number | null;
  avg_engagement_rate: number | null;
  follower_start: number | null;
  follower_end: number | null;
  follower_delta: number | null;
  follower_growth_pct: number | null;
  posting_frequency: number | null;
  posts_in_week: number;
  /** Daily reach values within the week (for sparklines). */
  daily_sparkline: number[];
};

export type IgWeekWowMetrics = {
  reach: PeriodChangeMetric;
  views: PeriodChangeMetric;
  engagement_rate: PeriodChangeMetric;
  follower_delta: PeriodChangeMetric;
  posting_frequency: PeriodChangeMetric;
};

export type IgWeekTopPost = {
  media_id: string;
  caption: string | null;
  image_url: string | null;
  permalink: string | null;
  media_type: string | null;
  media_product_type: string | null;
  engagement_score: number | null;
  reach: number;
  /** True when reach is inferred from views or week avg daily reach (Meta/ClarioSuite omitted post reach). */
  reach_estimated: boolean;
  posted_at: string | null;
  content_label: string;
};

export type IgWeekComparisons = {
  vs_historical_reach_pct: number | null;
  vs_historical_reach_note?: PeriodChangeDisplayNote;
  vs_historical_reach_capped?: boolean;
  vs_historical_engagement_pct: number | null;
  vs_historical_engagement_note?: PeriodChangeDisplayNote;
  vs_historical_engagement_capped?: boolean;
  vs_team_reach_pct: number | null;
  vs_team_reach_note?: PeriodChangeDisplayNote;
  vs_team_reach_capped?: boolean;
  vs_team_engagement_pct: number | null;
  vs_team_engagement_note?: PeriodChangeDisplayNote;
  vs_team_engagement_capped?: boolean;
  historical_weeks_sampled: number;
  team_avg_reach: number | null;
  team_avg_engagement: number | null;
  historical_avg_reach: number | null;
  historical_avg_engagement: number | null;
};

export type IgCrossPlatformNote = {
  text: string;
  signal: "aligned" | "divergent" | "sparse";
} | null;

export type IgCrossPlatformChartPoint = {
  date: string;
  reach: number;
  engagement_rate: number | null;
  new_subscribers: number;
  revenue: number;
  profile_visitors: number;
};

export type IgWeeklyCrossPlatformSection = {
  analytics: CrossPlatformAnalytics;
  chart: IgCrossPlatformChartPoint[];
  of_totals: {
    new_subscribers: number;
    profile_visitors: number;
    revenue: number;
  };
};

export type IgModelWeekSlice = {
  week: CustomWeekIndex;
  startYmd: string;
  endYmd: string;
  label: string;
  displayLabel: string;
  dayCount: number;
  elapsedDays: number;
  status: CustomWeekStatus;
  hasStarted: boolean;
  hasActivity: boolean;
  wowComparable: boolean;
  wowScaled: boolean;
  totals: IgWeekMetricTotals;
  wow: IgWeekWowMetrics;
  insights: IgWeeklyInsightTag[];
  talking_points: string;
  comparisons: IgWeekComparisons;
  top_post: IgWeekTopPost | null;
  cross_platform: IgCrossPlatformNote;
  cross_platform_section: IgWeeklyCrossPlatformSection | null;
  is_best_week_in_month: boolean;
};

export type IgWeeklyModelProgress = {
  modelId: string;
  modelName: string;
  accountCount: number;
  month_totals: IgWeekMetricTotals;
  weeks: IgModelWeekSlice[];
};

export type IgWeeklyWeekMeta = CustomWeekBoundary &
  CustomWeekProgress & {
    displayLabel: string;
  };

export type IgWeeklyProgressReport = {
  year: number;
  month: number;
  /** YYYY-MM */
  monthKey: string;
  /** Athens calendar "today" used for week status. */
  asOfYmd: string;
  weeks: IgWeeklyWeekMeta[];
  models: IgWeeklyModelProgress[];
  team_by_week: Array<{
    week: CustomWeekIndex;
    status: CustomWeekStatus;
    hasStarted: boolean;
    displayLabel: string;
    totals: IgWeekMetricTotals;
  }>;
  team_month_totals: IgWeekMetricTotals;
};

type FullTopPost = ClarioSuiteTopPostRow;

type HistoricalWeekAvg = {
  reachSum: number;
  erSum: number;
  erCount: number;
  samples: number;
};

function emptyTotals(): IgWeekMetricTotals {
  return {
    reach: 0,
    views: null,
    avg_engagement_rate: null,
    follower_start: null,
    follower_end: null,
    follower_delta: null,
    follower_growth_pct: null,
    posting_frequency: null,
    posts_in_week: 0,
    daily_sparkline: [],
  };
}

function emptyComparisons(): IgWeekComparisons {
  return {
    vs_historical_reach_pct: null,
    vs_historical_engagement_pct: null,
    vs_team_reach_pct: null,
    vs_team_engagement_pct: null,
    historical_weeks_sampled: 0,
    team_avg_reach: null,
    team_avg_engagement: null,
    historical_avg_reach: null,
    historical_avg_engagement: null,
  };
}

function emptyWow(current: IgWeekMetricTotals): IgWeekWowMetrics {
  const mk = (v: number): PeriodChangeMetric => ({
    current: v,
    previous: 0,
    pct_change: null,
    direction: "na",
  });
  return {
    reach: mk(current.reach),
    views: mk(current.views ?? 0),
    engagement_rate: mk(current.avg_engagement_rate ?? 0),
    follower_delta: mk(current.follower_delta ?? 0),
    posting_frequency: mk(current.posting_frequency ?? 0),
  };
}

function hasWeekActivity(t: IgWeekMetricTotals): boolean {
  return t.reach > 0 || t.posts_in_week > 0 || (t.follower_delta ?? 0) !== 0;
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  let m = month + delta;
  let y = year;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  return { year: y, month: m };
}

function sumWeekTotals(
  daily: IgDailyRow[],
  posts: IgPostRow[],
  boundary: CustomWeekBoundary
): IgWeekMetricTotals {
  const weekDaily = daily.filter(
    (d) => d.date >= boundary.startYmd && d.date <= boundary.endYmd
  );
  const range = { startYmd: boundary.startYmd, endYmd: boundary.endYmd };
  const summary = computeModelEngagementTotals(weekDaily, posts, range);
  const freq = postingFrequency(posts, boundary.startYmd, boundary.endYmd);

  const sparkline: number[] = [];
  const startParts = boundary.startYmd.split("-").map(Number);
  const endParts = boundary.endYmd.split("-").map(Number);
  if (startParts.length === 3 && endParts.length === 3) {
    const cur = new Date(Date.UTC(startParts[0]!, startParts[1]! - 1, startParts[2]!, 12));
    const end = new Date(Date.UTC(endParts[0]!, endParts[1]! - 1, endParts[2]!, 12));
    const byDate = new Map(weekDaily.map((d) => [d.date, d.reach]));
    while (cur <= end) {
      const ymd = cur.toISOString().slice(0, 10);
      sparkline.push(byDate.get(ymd) ?? 0);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }

  return {
    reach: summary.reach,
    views: summary.views,
    avg_engagement_rate: toFiniteRate(summary.avg_engagement_rate),
    follower_start: summary.follower_start,
    follower_end: summary.follower_end,
    follower_delta: summary.follower_delta,
    follower_growth_pct: followerGrowthRatePct(summary.follower_start, summary.follower_delta),
    posting_frequency: freq.posts_per_week,
    posts_in_week: freq.posts_in_range,
    daily_sparkline: sparkline,
  };
}

function addTotals(a: IgWeekMetricTotals, b: IgWeekMetricTotals): IgWeekMetricTotals {
  const views =
    a.views == null && b.views == null ? null : (a.views ?? 0) + (b.views ?? 0);
  const erValues = [a.avg_engagement_rate, b.avg_engagement_rate].filter(
    (x): x is number => x != null && x > 0
  );
  return {
    reach: a.reach + b.reach,
    views: views === 0 && a.views == null && b.views == null ? null : views,
    avg_engagement_rate:
      erValues.length > 0 ? erValues.reduce((s, n) => s + n, 0) / erValues.length : null,
    follower_start: a.follower_start ?? b.follower_start,
    follower_end: b.follower_end ?? a.follower_end,
    follower_delta:
      a.follower_delta != null || b.follower_delta != null
        ? (a.follower_delta ?? 0) + (b.follower_delta ?? 0)
        : null,
    follower_growth_pct: followerGrowthRatePct(
      a.follower_start ?? b.follower_start,
      (a.follower_delta ?? 0) + (b.follower_delta ?? 0)
    ),
    posting_frequency:
      a.posting_frequency != null || b.posting_frequency != null
        ? (a.posting_frequency ?? 0) + (b.posting_frequency ?? 0)
        : null,
    posts_in_week: a.posts_in_week + b.posts_in_week,
    daily_sparkline: a.daily_sparkline.length
      ? a.daily_sparkline.map((v, i) => v + (b.daily_sparkline[i] ?? 0))
      : b.daily_sparkline,
  };
}

function wowFromTotals(
  current: IgWeekMetricTotals,
  previous: IgWeekMetricTotals | null,
  opts: {
    currentElapsedDays: number;
    previousElapsedDays: number;
    comparable: boolean;
  }
): { wow: IgWeekWowMetrics; scaled: boolean } {
  if (
    !opts.comparable ||
    !previous ||
    opts.currentElapsedDays <= 0 ||
    opts.previousElapsedDays <= 0
  ) {
    return { wow: emptyWow(current), scaled: false };
  }

  const scale = opts.currentElapsedDays !== opts.previousElapsedDays;
  const norm = (value: number, days: number) => (scale ? value / days : value);

  return {
    scaled: scale,
    wow: {
      reach: igGuardedPeriodChange(
        norm(current.reach, opts.currentElapsedDays),
        norm(previous.reach, opts.previousElapsedDays),
        "reach"
      ),
      views: igGuardedPeriodChange(
        norm(current.views ?? 0, opts.currentElapsedDays),
        norm(previous.views ?? 0, opts.previousElapsedDays),
        "count"
      ),
      engagement_rate: igGuardedPeriodChange(
        current.avg_engagement_rate ?? 0,
        previous.avg_engagement_rate ?? 0,
        "engagement_rate"
      ),
      follower_delta: igGuardedPeriodChange(
        norm(current.follower_delta ?? 0, opts.currentElapsedDays),
        norm(previous.follower_delta ?? 0, opts.previousElapsedDays),
        "count"
      ),
      posting_frequency: igGuardedPeriodChange(
        norm(current.posting_frequency ?? 0, opts.currentElapsedDays),
        norm(previous.posting_frequency ?? 0, opts.previousElapsedDays),
        "rate"
      ),
    },
  };
}

function topPostInWeek(
  posts: FullTopPost[],
  boundary: CustomWeekBoundary,
  avgReach: number | null
): IgWeekTopPost | null {
  const inWeek = posts.filter((p) => {
    if (!p.posted_at) return false;
    const ymd = p.posted_at.slice(0, 10);
    return ymd >= boundary.startYmd && ymd <= boundary.endYmd;
  });
  if (!inWeek.length) return null;

  const sorted = [...inWeek].sort((a, b) => {
    const scoreA = resolvePostEngagementScore(a, { estimatedReach: avgReach }) ?? 0;
    const scoreB = resolvePostEngagementScore(b, { estimatedReach: avgReach }) ?? 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    const reachA = resolvePostReach(a, { estimatedReach: avgReach }).reach;
    const reachB = resolvePostReach(b, { estimatedReach: avgReach }).reach;
    return reachB - reachA;
  });
  const best = sorted[0];
  if (!best) return null;

  const group = classifyIgPost({
    mediaType: best.media_type,
    mediaProductType: best.media_product_type,
  });
  const resolvedReach = resolvePostReach(best, { estimatedReach: avgReach });

  return {
    media_id: best.media_id,
    caption: best.caption,
    image_url: best.image_url,
    permalink: best.permalink,
    media_type: best.media_type,
    media_product_type: best.media_product_type,
    engagement_score: resolvePostEngagementScore(best, { estimatedReach: avgReach }),
    reach: resolvedReach.reach,
    reach_estimated: resolvedReach.estimated,
    posted_at: best.posted_at,
    content_label: igPostGroupLabel(group).replace(/s$/, "").toLowerCase(),
  };
}

function buildHistoricalAvgs(
  modelId: string,
  year: number,
  month: number,
  historicalDaily: Map<string, IgDailyRow[]>,
  historicalPosts: Map<string, IgPostRow[]>
): Map<CustomWeekIndex, HistoricalWeekAvg> {
  const result = new Map<CustomWeekIndex, HistoricalWeekAvg>();
  const daily = historicalDaily.get(modelId) ?? [];
  const posts = historicalPosts.get(modelId) ?? [];

  for (let i = 1; i <= 3; i++) {
    const { year: py, month: pm } = shiftMonth(year, month, -i);
    const boundaries = getCustomWeekBoundaries(py, pm);
    for (const boundary of boundaries) {
      const totals = sumWeekTotals(daily, posts, boundary);
      if (totals.reach <= 0 && totals.posts_in_week <= 0) continue;
      const prev = result.get(boundary.week) ?? {
        reachSum: 0,
        erSum: 0,
        erCount: 0,
        samples: 0,
      };
      result.set(boundary.week, {
        reachSum: prev.reachSum + totals.reach,
        erSum:
          prev.erSum +
          (totals.avg_engagement_rate != null && totals.avg_engagement_rate > 0
            ? totals.avg_engagement_rate
            : 0),
        erCount:
          prev.erCount +
          (totals.avg_engagement_rate != null && totals.avg_engagement_rate > 0 ? 1 : 0),
        samples: prev.samples + 1,
      });
    }
  }
  return result;
}

function resolveHistoricalAvg(
  raw: HistoricalWeekAvg | undefined
): { reach: number; engagement: number | null; samples: number } | null {
  if (!raw || raw.samples <= 0) return null;
  return {
    reach: raw.reachSum / raw.samples,
    engagement: raw.erCount > 0 ? raw.erSum / raw.erCount : null,
    samples: raw.samples,
  };
}

function buildCrossPlatformNote(params: {
  modelId: string;
  boundary: CustomWeekBoundary;
  igReachWowPct: number | null;
  ofByModelDate: Map<string, Map<string, { new_subscribers: number }>>;
}): IgCrossPlatformNote {
  const byDate = params.ofByModelDate.get(params.modelId);
  if (!byDate) return null;

  let days = 0;
  let newSubs = 0;
  const cur = params.boundary.startYmd;
  const end = params.boundary.endYmd;
  let ymd = cur;
  while (ymd <= end) {
    const row = byDate.get(ymd);
    if (row) {
      days += 1;
      newSubs += row.new_subscribers;
    }
    ymd = addDaysAthensYmd(ymd, 1);
  }
  if (days < 3) return null;

  const igUp = (params.igReachWowPct ?? 0) > 12;
  const igDown = (params.igReachWowPct ?? 0) < -12;
  const subsStrong = newSubs >= 5;

  if (igUp && subsStrong) {
    return {
      signal: "aligned",
      text: `OnlyFans added ${newSubs} new subs in the same window — IG reach lift may be feeding the funnel.`,
    };
  }
  if (igUp && newSubs <= 1) {
    return {
      signal: "divergent",
      text: `IG reach improved but OnlyFans saw only ${newSubs} new sub${newSubs === 1 ? "" : "s"} — worth checking bio link, offer, or posting-to-CTA timing.`,
    };
  }
  if (igDown && newSubs >= 5) {
    return {
      signal: "divergent",
      text: `OnlyFans still picked up ${newSubs} new subs despite softer IG reach — subs may be coming from other channels.`,
    };
  }
  if (subsStrong) {
    return {
      signal: "aligned",
      text: `Cross-platform: ${newSubs} new OnlyFans subs during this IG week.`,
    };
  }
  return null;
}


function toCrossPlatformIgDaily(rows: IgDailyRow[]): Array<{
  date: string;
  reach: number;
  views: number;
  total_interactions: number;
  follower_count: number | null;
  engagement_rate: number | null;
}> {
  return rows.map((d) => ({
    date: d.date,
    reach: d.reach,
    views: d.views ?? 0,
    total_interactions: d.total_interactions ?? 0,
    follower_count: d.follower_count,
    engagement_rate: d.engagement_rate,
  }));
}

function toCrossPlatformTopPosts(posts: FullTopPost[]): Array<{
  media_id: string;
  permalink: string | null;
  caption: string | null;
  image_url: string | null;
  engagement_score: number | null;
  reach: number;
  posted_at: string | null;
  rank: number;
}> {
  return posts.map((p, i) => ({
    media_id: p.media_id,
    permalink: p.permalink,
    caption: p.caption,
    image_url: p.image_url,
    engagement_score: p.engagement_score,
    reach: p.reach,
    posted_at: p.posted_at,
    rank: i + 1,
  }));
}

function slimCrossPlatformAnalytics(
  analytics: CrossPlatformAnalytics
): CrossPlatformAnalytics {
  // Weekly Progress UI only needs the first content window + compact notes.
  // Dropping unused series/windows keeps the API payload from ballooning per model×week.
  return {
    ...analytics,
    series: [],
    growth_alignment: {
      ...analytics.growth_alignment,
      series: [],
    },
    content_conversion: {
      ...analytics.content_conversion,
      windows: analytics.content_conversion.windows.slice(0, 1),
    },
  };
}

function buildWeeklyCrossPlatformSection(params: {
  modelId: string;
  modelName: string;
  boundary: CustomWeekBoundary;
  igDaily: IgDailyRow[];
  ofDaily: CreatorDailyStatsRow[];
  ofTransactions: CreatorTransactionRow[];
  topPosts: FullTopPost[];
  allIgDaily: IgDailyRow[];
  allOfDaily: CreatorDailyStatsRow[];
  allOfTx: CreatorTransactionRow[];
}): IgWeeklyCrossPlatformSection | null {
  const { startYmd, endYmd } = params.boundary;
  const weekIg = params.igDaily.filter((d) => d.date >= startYmd && d.date <= endYmd);
  const weekOf = params.ofDaily.filter((d) => d.date >= startYmd && d.date <= endYmd);
  const weekTx = filterCreatorTransactionsInAthensYmdRange(
    params.ofTransactions,
    startYmd,
    endYmd
  );

  if (weekIg.length === 0 && weekOf.length === 0) return null;

  const prev = previousPeriodRange(startYmd, endYmd);
  const prevIg = params.allIgDaily.filter(
    (d) => d.date >= prev.startYmd && d.date <= prev.endYmd
  );
  const prevOf = params.allOfDaily.filter(
    (d) => d.date >= prev.startYmd && d.date <= prev.endYmd
  );
  const prevGross = sumCreatorTxRevenue(
    filterCreatorTransactionsInAthensYmdRange(
      params.allOfTx,
      prev.startYmd,
      prev.endYmd
    )
  );

  // Only posts near this week matter for content→conversion windows.
  const weekPosts = params.topPosts.filter((p) => {
    if (!p.posted_at) return false;
    const ymd = p.posted_at.slice(0, 10);
    return ymd >= addDaysAthensYmd(startYmd, -1) && ymd <= addDaysAthensYmd(endYmd, 3);
  });

  const analytics = slimCrossPlatformAnalytics(
    deriveCrossPlatformAnalytics({
      modelRecordId: params.modelId,
      modelName: params.modelName,
      startYmd,
      endYmd,
      igDaily: toCrossPlatformIgDaily(weekIg),
      ofDaily: weekOf,
      ofTransactions: weekTx,
      topPosts: toCrossPlatformTopPosts(weekPosts),
      prevIgDaily: toCrossPlatformIgDaily(prevIg),
      prevOfDaily: prevOf,
      prevGross,
    })
  );

  const igByDate = new Map(weekIg.map((d) => [d.date, d]));
  const ofByDate = new Map(weekOf.map((d) => [d.date, d]));
  const revByDate = new Map<string, number>();
  for (const t of weekTx) {
    if (!t.created_time) continue;
    const ymd = ymdInAthens(t.created_time);
    if (!ymd) continue;
    revByDate.set(ymd, (revByDate.get(ymd) ?? 0) + creatorTxRevenueAmount(t));
  }

  const chart: IgCrossPlatformChartPoint[] = [];
  let cursor = startYmd;
  while (cursor <= endYmd) {
    const ig = igByDate.get(cursor);
    const of = ofByDate.get(cursor);
    chart.push({
      date: cursor,
      reach: ig?.reach ?? 0,
      engagement_rate: ig?.engagement_rate ?? null,
      new_subscribers: of?.new_subscribers ?? 0,
      revenue: revByDate.get(cursor) ?? 0,
      profile_visitors: of?.profile_visitors ?? 0,
    });
    cursor = addDaysAthensYmd(cursor, 1);
  }

  const of_totals = {
    new_subscribers: analytics.growth_alignment.of_new_subscribers_total,
    profile_visitors: chart.reduce((s, d) => s + d.profile_visitors, 0),
    revenue: sumCreatorTxRevenue(weekTx),
  };

  return { analytics, chart, of_totals };
}

/**
 * Aggregate clariosuite_daily_insights into custom 4-week buckets for a calendar month.
 * Multi-account rows are combined per model via aggregateIgDailyByDate.
 */
export async function getInstagramWeeklyProgressReport(
  year: number,
  month: number,
  filters?: { modelRecordId?: string }
): Promise<IgWeeklyProgressReport> {
  const asOfYmd = getTodayYmdAthens();
  const boundaries = getCustomWeekBoundaries(year, month);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const monthStart = boundaries[0]?.startYmd ?? `${monthKey}-01`;
  const monthEnd = boundaries[boundaries.length - 1]?.endYmd ?? monthStart;

  const histStart = shiftMonth(year, month, -3);
  const histBoundaries = getCustomWeekBoundaries(histStart.year, histStart.month);
  const historicalStartYmd = histBoundaries[0]?.startYmd ?? monthStart;
  const historicalEndYmd = addDaysAthensYmd(monthStart, -1);
  // Cross-platform OF lookback only needs prior-week overlap for week 1 — not 3 months of txs.
  // Fetching ~4 months of done txs was a sequential scan of tens of thousands of rows.
  const ofLookbackStartYmd = addDaysAthensYmd(monthStart, -14);

  let linked = await listLinkedClarioSuiteModels();
  if (filters?.modelRecordId) {
    linked = linked.filter((l) => l.modelRecordId === filters.modelRecordId);
  }

  const [allDailyCombined, allTopPostsMap, ofDailyRows, ofRevenueRows] = await Promise.all([
    linked.length
      ? queryClarioSuiteDailyInsights({
          startYmd: historicalStartYmd,
          endYmd: monthEnd,
        })
      : Promise.resolve([]),
    linked.length
      ? queryClarioSuiteTopPostsForModels({
          modelRecordIds: linked.map((m) => m.modelRecordId),
          limitPerModel: 50,
        })
      : Promise.resolve(new Map<string, FullTopPost[]>()),
    linked.length
      ? listCreatorDailyStats({ startYmd: ofLookbackStartYmd, endYmd: monthEnd })
      : Promise.resolve([]),
    linked.length
      ? listCreatorRevenueByAthensDay({
          startYmd: ofLookbackStartYmd,
          endYmd: monthEnd,
        })
      : Promise.resolve([]),
  ]);

  const ofTxRows = syntheticCreatorTxFromDailyRevenue(ofRevenueRows);

  const allDaily = allDailyCombined.filter(
    (d) => d.date >= monthStart && d.date <= monthEnd
  );
  const historicalDailyRows =
    historicalEndYmd >= historicalStartYmd
      ? allDailyCombined.filter(
          (d) => d.date >= historicalStartYmd && d.date <= historicalEndYmd
        )
      : [];
  const allTopPosts = linked.map((m) => ({
    modelId: m.modelRecordId,
    posts: allTopPostsMap.get(m.modelRecordId) ?? [],
  }));

  const fullPostsByModel = new Map<string, FullTopPost[]>();
  const postsByModel = new Map<string, IgPostRow[]>();
  for (const row of allTopPosts) {
    fullPostsByModel.set(row.modelId, row.posts);
    postsByModel.set(
      row.modelId,
      row.posts.map((p) => ({
        media_type: p.media_type,
        media_product_type: p.media_product_type,
        engagement_score: p.engagement_score,
        reach: p.reach,
        likes: p.likes,
        comments: p.comments,
        shares: p.shares,
        saved: p.saved,
        views: p.views,
        posted_at: p.posted_at,
      }))
    );
  }

  function ingestDailyRows(
    rows: typeof allDaily,
    target: Map<string, IgDailyRow[]>
  ): void {
    for (const m of linked) {
      if (!target.has(m.modelRecordId)) target.set(m.modelRecordId, []);
    }
    for (const row of rows) {
      const modelId = row.model_record_id;
      if (!modelId || !target.has(modelId)) continue;
      target.get(modelId)!.push({
        date: row.date,
        reach: row.reach,
        views: row.views,
        total_interactions: row.total_interactions,
        follower_count: row.follower_count,
        engagement_rate: toFiniteRate(row.engagement_rate),
      });
    }
    for (const [modelId, rows] of target) {
      target.set(modelId, aggregateIgDailyByDate(rows));
    }
  }

  const dailyByModel = new Map<string, IgDailyRow[]>();
  const historicalDailyByModel = new Map<string, IgDailyRow[]>();
  ingestDailyRows(allDaily, dailyByModel);
  ingestDailyRows(historicalDailyRows, historicalDailyByModel);

  const ofByModelDate = new Map<string, Map<string, { new_subscribers: number }>>();
  const ofDailyByModel = new Map<string, CreatorDailyStatsRow[]>();
  const ofTxByModel = new Map<string, CreatorTransactionRow[]>();
  for (const row of ofDailyRows) {
    const modelId = row.model_record_id;
    if (!modelId) continue;
    if (!ofByModelDate.has(modelId)) ofByModelDate.set(modelId, new Map());
    ofByModelDate.get(modelId)!.set(row.date, {
      new_subscribers: row.new_subscribers ?? 0,
    });
    if (!ofDailyByModel.has(modelId)) ofDailyByModel.set(modelId, []);
    ofDailyByModel.get(modelId)!.push(row);
  }
  for (const tx of ofTxRows) {
    const modelId = tx.model_record_id;
    if (!modelId) continue;
    if (!ofTxByModel.has(modelId)) ofTxByModel.set(modelId, []);
    ofTxByModel.get(modelId)!.push(tx);
  }

  const modelWeekTotals = new Map<string, Map<CustomWeekIndex, IgWeekMetricTotals>>();
  for (const m of linked) {
    const daily = dailyByModel.get(m.modelRecordId) ?? [];
    const posts = postsByModel.get(m.modelRecordId) ?? [];
    const weekMap = new Map<CustomWeekIndex, IgWeekMetricTotals>();
    for (const boundary of boundaries) {
      weekMap.set(boundary.week, sumWeekTotals(daily, posts, boundary));
    }
    modelWeekTotals.set(m.modelRecordId, weekMap);
  }

  const weekMeta: IgWeeklyWeekMeta[] = boundaries.map((boundary) => {
    let anyActivity = false;
    for (const m of linked) {
      const t = modelWeekTotals.get(m.modelRecordId)?.get(boundary.week) ?? emptyTotals();
      if (hasWeekActivity(t)) {
        anyActivity = true;
        break;
      }
    }
    const progress = classifyCustomWeekProgress(boundary, asOfYmd, anyActivity);
    return {
      ...boundary,
      ...progress,
      displayLabel: formatCustomWeekDisplayLabel(boundary, progress),
    };
  });

  const teamReachByWeek = new Map<CustomWeekIndex, number[]>();
  const teamPostByWeek = new Map<CustomWeekIndex, number[]>();
  const teamErByWeek = new Map<CustomWeekIndex, number[]>();
  for (const meta of weekMeta) {
    const reaches: number[] = [];
    const posts: number[] = [];
    const ers: number[] = [];
    if (meta.hasStarted) {
      for (const m of linked) {
        const t = modelWeekTotals.get(m.modelRecordId)?.get(meta.week) ?? emptyTotals();
        if (t.reach > 0) reaches.push(t.reach);
        if (t.posts_in_week > 0) posts.push(t.posts_in_week);
        if (t.avg_engagement_rate != null && t.avg_engagement_rate > 0) {
          ers.push(t.avg_engagement_rate);
        }
      }
    }
    teamReachByWeek.set(meta.week, reaches);
    teamPostByWeek.set(meta.week, posts);
    teamErByWeek.set(meta.week, ers);
  }

  const models: IgWeeklyModelProgress[] = linked.map((m) => {
    const daily = dailyByModel.get(m.modelRecordId) ?? [];
    const posts = postsByModel.get(m.modelRecordId) ?? [];
    const fullPosts = fullPostsByModel.get(m.modelRecordId) ?? [];
    const totalsMap = modelWeekTotals.get(m.modelRecordId)!;
    const historicalAvgs = buildHistoricalAvgs(
      m.modelRecordId,
      year,
      month,
      historicalDailyByModel,
      postsByModel
    );

    const bestReachWeek = (() => {
      let best: CustomWeekIndex | null = null;
      let bestReach = -1;
      for (const boundary of boundaries) {
        const t = totalsMap.get(boundary.week) ?? emptyTotals();
        if (t.reach > bestReach) {
          bestReach = t.reach;
          best = boundary.week;
        }
      }
      return best;
    })();

    const weekSlices: IgModelWeekSlice[] = boundaries.map((boundary, idx) => {
      const totals = totalsMap.get(boundary.week) ?? emptyTotals();
      const activity = hasWeekActivity(totals);
      const progress = classifyCustomWeekProgress(boundary, asOfYmd, activity);
      const displayLabel = formatCustomWeekDisplayLabel(boundary, progress);

      const prevBoundary = idx > 0 ? boundaries[idx - 1]! : null;
      const prevTotals = prevBoundary
        ? (totalsMap.get(prevBoundary.week) ?? emptyTotals())
        : null;
      const prevActivity = prevTotals ? hasWeekActivity(prevTotals) : false;
      const prevProgress = prevBoundary
        ? classifyCustomWeekProgress(prevBoundary, asOfYmd, prevActivity)
        : null;

      const wowComparable =
        progress.hasStarted &&
        prevProgress != null &&
        prevProgress.hasStarted &&
        prevTotals != null;

      const { wow, scaled: wowScaled } = wowFromTotals(totals, prevTotals, {
        currentElapsedDays: progress.elapsedDays,
        previousElapsedDays: prevProgress?.elapsedDays ?? 0,
        comparable: wowComparable,
      });

      const series = postingVsReachSeries(posts, daily, boundary.startYmd, boundary.endYmd);
      const corr = pearsonCorrelation(
        series.map((r) => r.posts),
        series.map((r) => r.reach)
      );

      const teamReaches = teamReachByWeek.get(boundary.week) ?? [];
      const teamAvgReach = avg(teamReaches);
      const teamErs = teamErByWeek.get(boundary.week) ?? [];
      const teamAvgEngagement = avg(teamErs);
      const teamMedianPosting = medianIgMetric(teamPostByWeek.get(boundary.week) ?? []);
      const teamMedianEngagement = medianIgMetric(teamErs);

      const hist = resolveHistoricalAvg(historicalAvgs.get(boundary.week));
      const histReach = hist?.samples
        ? pctVsBaseline(totals.reach, hist.reach, "reach", {
            historicalSamples: hist.samples,
          })
        : { pct: null };
      const histEngagement =
        hist?.engagement != null && totals.avg_engagement_rate != null
          ? pctVsBaseline(totals.avg_engagement_rate, hist.engagement, "engagement_rate", {
              historicalSamples: hist?.samples,
            })
          : { pct: null };
      const teamReach =
        teamAvgReach != null && teamAvgReach > 0
          ? pctVsBaseline(totals.reach, teamAvgReach, "reach")
          : { pct: null };
      const teamEngagement =
        teamAvgEngagement != null &&
        teamAvgEngagement > 0 &&
        totals.avg_engagement_rate != null
          ? pctVsBaseline(totals.avg_engagement_rate, teamAvgEngagement, "engagement_rate")
          : { pct: null };

      const comparisons: IgWeekComparisons = {
        vs_historical_reach_pct: histReach.pct,
        vs_historical_reach_note: histReach.display_note,
        vs_historical_reach_capped: histReach.pct_capped,
        vs_historical_engagement_pct: histEngagement.pct,
        vs_historical_engagement_note: histEngagement.display_note,
        vs_historical_engagement_capped: histEngagement.pct_capped,
        vs_team_reach_pct: teamReach.pct,
        vs_team_reach_note: teamReach.display_note,
        vs_team_reach_capped: teamReach.pct_capped,
        vs_team_engagement_pct: teamEngagement.pct,
        vs_team_engagement_note: teamEngagement.display_note,
        vs_team_engagement_capped: teamEngagement.pct_capped,
        historical_weeks_sampled: hist?.samples ?? 0,
        team_avg_reach: teamAvgReach,
        team_avg_engagement: teamAvgEngagement,
        historical_avg_reach: hist?.reach ?? null,
        historical_avg_engagement: hist?.engagement ?? null,
      };

      const isConsistentPoster =
        totals.posts_in_week >= 3 &&
        teamMedianPosting != null &&
        totals.posting_frequency != null &&
        totals.posting_frequency >= teamMedianPosting * 0.85 &&
        totals.posting_frequency <= teamMedianPosting * 1.15;

      const isBestWeekInMonth = bestReachWeek === boundary.week && totals.reach > 0;

      const insights = progress.hasStarted
        ? generateIgWeeklyInsights({
            reach: totals.reach,
            avg_engagement_rate: totals.avg_engagement_rate,
            follower_delta: totals.follower_delta,
            posting_frequency: totals.posting_frequency,
            posts_in_week: totals.posts_in_week,
            reach_wow_pct: wowComparable ? wow.reach.pct_change : null,
            engagement_wow_pct: wowComparable ? wow.engagement_rate.pct_change : null,
            follower_delta_wow_pct: wowComparable ? wow.follower_delta.pct_change : null,
            posting_wow_pct: wowComparable ? wow.posting_frequency.pct_change : null,
            prior_follower_delta: prevTotals?.follower_delta ?? null,
            team_week_reach: teamReaches,
            team_median_posting: teamMedianPosting,
            team_median_engagement: teamMedianEngagement,
            posting_reach_correlation: corr,
            is_best_week_in_month: isBestWeekInMonth,
            is_consistent_poster: isConsistentPoster,
          })
        : [];

      const weekAvgReach =
        totals.daily_sparkline.filter((v) => v > 0).length > 0
          ? totals.daily_sparkline.reduce((s, v) => s + v, 0) /
            totals.daily_sparkline.filter((v) => v > 0).length
          : null;
      const topPost = progress.hasStarted
        ? topPostInWeek(fullPosts, boundary, weekAvgReach)
        : null;

      const crossPlatform = progress.hasStarted
        ? buildCrossPlatformNote({
            modelId: m.modelRecordId,
            boundary,
            igReachWowPct: wowComparable ? wow.reach.pct_change : null,
            ofByModelDate,
          })
        : null;

      const cross_platform_section = progress.hasStarted
        ? buildWeeklyCrossPlatformSection({
            modelId: m.modelRecordId,
            modelName: m.modelName,
            boundary,
            igDaily: daily,
            ofDaily: ofDailyByModel.get(m.modelRecordId) ?? [],
            ofTransactions: ofTxByModel.get(m.modelRecordId) ?? [],
            topPosts: fullPosts,
            allIgDaily: [...daily, ...(historicalDailyByModel.get(m.modelRecordId) ?? [])],
            allOfDaily: ofDailyByModel.get(m.modelRecordId) ?? [],
            allOfTx: ofTxByModel.get(m.modelRecordId) ?? [],
          })
        : null;

      const talking_points = progress.hasStarted
        ? generateIgWeeklyTalkingPoints({
            modelName: m.modelName,
            week: boundary.week,
            reach: totals.reach,
            reach_wow_pct: wowComparable ? wow.reach.pct_change : null,
            reach_wow_note: wowComparable ? wow.reach.display_note : undefined,
            reach_wow_capped: wowComparable ? wow.reach.pct_capped : undefined,
            avg_engagement_rate: totals.avg_engagement_rate,
            engagement_wow_pct: wowComparable ? wow.engagement_rate.pct_change : null,
            engagement_wow_note: wowComparable ? wow.engagement_rate.display_note : undefined,
            engagement_wow_capped: wowComparable ? wow.engagement_rate.pct_capped : undefined,
            follower_delta: totals.follower_delta,
            follower_growth_pct: totals.follower_growth_pct,
            posts_in_week: totals.posts_in_week,
            posting_frequency: totals.posting_frequency,
            vs_historical_reach_pct: comparisons.vs_historical_reach_pct,
            vs_historical_reach_note: comparisons.vs_historical_reach_note,
            vs_historical_reach_capped: comparisons.vs_historical_reach_capped,
            vs_historical_engagement_pct: comparisons.vs_historical_engagement_pct,
            vs_historical_engagement_note: comparisons.vs_historical_engagement_note,
            vs_historical_engagement_capped: comparisons.vs_historical_engagement_capped,
            vs_team_reach_pct: comparisons.vs_team_reach_pct,
            vs_team_reach_note: comparisons.vs_team_reach_note,
            vs_team_reach_capped: comparisons.vs_team_reach_capped,
            vs_team_engagement_pct: comparisons.vs_team_engagement_pct,
            vs_team_engagement_note: comparisons.vs_team_engagement_note,
            vs_team_engagement_capped: comparisons.vs_team_engagement_capped,
            is_best_week_in_month: isBestWeekInMonth,
            top_post_label: topPost?.content_label ?? null,
            cross_platform_note: crossPlatform?.text ?? null,
            historical_weeks_sampled: comparisons.historical_weeks_sampled,
          })
        : "";

      return {
        week: boundary.week,
        startYmd: boundary.startYmd,
        endYmd: boundary.endYmd,
        label: boundary.label,
        displayLabel,
        dayCount: boundary.dayCount,
        elapsedDays: progress.elapsedDays,
        status: progress.status,
        hasStarted: progress.hasStarted,
        hasActivity: activity,
        wowComparable,
        wowScaled,
        totals,
        wow,
        insights,
        talking_points,
        comparisons,
        top_post: topPost,
        cross_platform: crossPlatform,
        cross_platform_section,
        is_best_week_in_month: isBestWeekInMonth,
      };
    });

    const monthBoundary = {
      week: 1 as CustomWeekIndex,
      startYmd: monthStart,
      endYmd: monthEnd,
      dayCount: boundaries.reduce((s, b) => s + b.dayCount, 0),
      label: monthKey,
    };
    const month_totals = sumWeekTotals(daily, posts, monthBoundary);

    return {
      modelId: m.modelRecordId,
      modelName: m.modelName,
      accountCount: m.accounts.length,
      month_totals,
      weeks: weekSlices,
    };
  });

  models.sort((a, b) => b.month_totals.reach - a.month_totals.reach);

  const team_by_week = weekMeta.map((meta) => {
    const totals = emptyTotals();
    for (const row of models) {
      const w = row.weeks.find((x) => x.week === meta.week);
      if (!w || (!w.hasStarted && !w.hasActivity)) continue;
      Object.assign(totals, addTotals(totals, w.totals));
    }
    return {
      week: meta.week,
      status: meta.status,
      hasStarted: meta.hasStarted,
      displayLabel: meta.displayLabel,
      totals,
    };
  });

  const team_month_totals = emptyTotals();
  for (const row of models) {
    if (row.month_totals.reach <= 0 && row.month_totals.posts_in_week <= 0) continue;
    Object.assign(team_month_totals, addTotals(team_month_totals, row.month_totals));
  }

  return {
    year,
    month,
    monthKey,
    asOfYmd,
    weeks: weekMeta,
    models,
    team_by_week,
    team_month_totals,
  };
}

/** Utility: bucket raw daily rows by custom week index (for tests). */
export function bucketDailyByCustomWeek(
  rows: Array<{ date: string }>,
  year: number,
  month: number
): Map<CustomWeekIndex, number> {
  const counts = new Map<CustomWeekIndex, number>();
  for (const row of rows) {
    const wi = customWeekIndexForYmd(row.date);
    if (wi == null) continue;
    counts.set(wi, (counts.get(wi) ?? 0) + 1);
  }
  for (const b of getCustomWeekBoundaries(year, month)) {
    if (!counts.has(b.week)) counts.set(b.week, 0);
  }
  return counts;
}
