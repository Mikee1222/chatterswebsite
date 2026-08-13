/**
 * Instagram Insights — custom 4-week/month breakdown per linked model.
 * Mirrors Chatter Performance Weekly Progress (`services/infloww-performance.ts`).
 */

import { getTodayYmdAthens } from "@/lib/airtable-datetime";
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
import {
  generateIgWeeklyInsights,
  medianIgMetric,
  type IgWeeklyInsightTag,
} from "@/lib/instagram-weekly-insights";
import {
  aggregateIgDailyByDate,
  computeModelEngagementTotals,
  pearsonCorrelation,
  postingFrequency,
  postingVsReachSeries,
  toFiniteRate,
  type IgDailyRow,
  type IgPostRow,
} from "@/lib/instagram-insights-stats";
import {
  computePctChange,
  type PeriodChangeMetric,
} from "@/services/infloww-analytics";
import {
  listLinkedClarioSuiteModels,
  queryClarioSuiteDailyInsights,
  queryClarioSuiteTopPosts,
} from "@/services/clariosuite-sync";

export type IgWeekMetricTotals = {
  reach: number;
  views: number | null;
  avg_engagement_rate: number | null;
  follower_start: number | null;
  follower_end: number | null;
  follower_delta: number | null;
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

function emptyTotals(): IgWeekMetricTotals {
  return {
    reach: 0,
    views: null,
    avg_engagement_rate: null,
    follower_start: null,
    follower_end: null,
    follower_delta: null,
    posting_frequency: null,
    posts_in_week: 0,
    daily_sparkline: [],
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
    posting_frequency: freq.posts_per_week,
    posts_in_week: freq.posts_in_range,
    daily_sparkline: sparkline,
  };
}

function addTotals(a: IgWeekMetricTotals, b: IgWeekMetricTotals): IgWeekMetricTotals {
  const views =
    a.views == null && b.views == null
      ? null
      : (a.views ?? 0) + (b.views ?? 0);
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
      reach: computePctChange(
        norm(current.reach, opts.currentElapsedDays),
        norm(previous.reach, opts.previousElapsedDays)
      ),
      views: computePctChange(
        norm(current.views ?? 0, opts.currentElapsedDays),
        norm(previous.views ?? 0, opts.previousElapsedDays)
      ),
      engagement_rate: computePctChange(
        current.avg_engagement_rate ?? 0,
        previous.avg_engagement_rate ?? 0
      ),
      follower_delta: computePctChange(
        norm(current.follower_delta ?? 0, opts.currentElapsedDays),
        norm(previous.follower_delta ?? 0, opts.previousElapsedDays)
      ),
      posting_frequency: computePctChange(
        norm(current.posting_frequency ?? 0, opts.currentElapsedDays),
        norm(previous.posting_frequency ?? 0, opts.previousElapsedDays)
      ),
    },
  };
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

  let linked = await listLinkedClarioSuiteModels();
  if (filters?.modelRecordId) {
    linked = linked.filter((l) => l.modelRecordId === filters.modelRecordId);
  }

  const [allDaily, allTopPosts] = await Promise.all([
    linked.length
      ? queryClarioSuiteDailyInsights({ startYmd: monthStart, endYmd: monthEnd })
      : Promise.resolve([]),
    Promise.all(
      linked.map(async (m) => {
        const posts: Awaited<ReturnType<typeof queryClarioSuiteTopPosts>> = [];
        for (const a of m.accounts) {
          posts.push(
            ...(await queryClarioSuiteTopPosts({ igUserId: a.igUserId, limit: 50 }))
          );
        }
        return { modelId: m.modelRecordId, posts };
      })
    ),
  ]);

  const postsByModel = new Map<string, IgPostRow[]>();
  for (const row of allTopPosts) {
    postsByModel.set(row.modelId, row.posts);
  }

  const dailyByModel = new Map<string, IgDailyRow[]>();
  for (const m of linked) {
    dailyByModel.set(m.modelRecordId, []);
  }
  for (const row of allDaily) {
    const modelId = row.model_record_id;
    if (!modelId || !dailyByModel.has(modelId)) continue;
    dailyByModel.get(modelId)!.push({
      date: row.date,
      reach: row.reach,
      views: row.views,
      total_interactions: row.total_interactions,
      follower_count: row.follower_count,
      engagement_rate: toFiniteRate(row.engagement_rate),
    });
  }
  for (const [modelId, rows] of dailyByModel) {
    dailyByModel.set(modelId, aggregateIgDailyByDate(rows));
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
    const totalsMap = modelWeekTotals.get(m.modelRecordId)!;

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

      const series = postingVsReachSeries(
        posts,
        daily,
        boundary.startYmd,
        boundary.endYmd
      );
      const corr = pearsonCorrelation(
        series.map((r) => r.posts),
        series.map((r) => r.reach)
      );

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
            team_week_reach: teamReachByWeek.get(boundary.week) ?? [],
            team_median_posting: medianIgMetric(teamPostByWeek.get(boundary.week) ?? []),
            team_median_engagement: medianIgMetric(teamErByWeek.get(boundary.week) ?? []),
            posting_reach_correlation: corr,
          })
        : [];

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
