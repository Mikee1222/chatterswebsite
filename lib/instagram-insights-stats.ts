/**
 * Pure Instagram Insights stats helpers (agency overview, compare, consistency).
 */

import { addDaysAthensYmd, getTodayYmdAthens } from "@/lib/airtable-datetime";
import {
  CLARIOSUITE_MAX_INSIGHTS_RANGE,
  CLARIOSUITE_MIN_INSIGHTS_RANGE,
  computePostEngagementScore,
} from "@/lib/clariosuite-api";
import { classifyIgPost, type IgPostGroup } from "@/lib/instagram-insights-ui";
import { computeConsistencyScore } from "@/services/infloww-analytics";

/** Coerce Postgres numeric / JSON string rates to a finite number, else null. */
export function toFiniteRate(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Coerce nullable DB metrics to 0 for safe summation (null ≠ “missing views series”). */
export function coalesceIgMetric(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Mean daily reach on active days — used to estimate post ER when media reach was not synced. */
export function avgDailyReach(daily: IgDailyRow[]): number | null {
  const active = daily.filter((d) => coalesceIgMetric(d.reach) > 0);
  if (!active.length) return null;
  return active.reduce((s, d) => s + coalesceIgMetric(d.reach), 0) / active.length;
}

/** Minimum days with reach before showing consistency (avoids misleading scores on new links). */
export const IG_MIN_CONSISTENCY_DAYS = 14;
/** Minimum calendar days before posting↔reach correlation is shown. */
export const IG_MIN_CORRELATION_DAYS = 14;
/** Minimum days with at least one post before correlation is shown. */
export const IG_MIN_CORRELATION_POST_DAYS = 5;
/** Minimum positive follower points before rendering follower trend chart. */
export const IG_MIN_FOLLOWER_TREND_POINTS = 2;

export type IgDailyRow = {
  date: string;
  reach: number;
  views: number;
  total_interactions: number;
  follower_count: number | null;
  engagement_rate: number | null;
};

export type IgPostRow = {
  media_type?: string | null;
  media_product_type?: string | null;
  engagement_score: number | null;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saved?: number;
  views?: number;
  posted_at?: string | null;
};

/**
 * Post-level reach for display/ranking — stored reach, else views (common for REELS when Meta omits reach),
 * else optional estimated account daily reach for the week.
 */
export function resolvePostReach(
  post: IgPostRow,
  opts?: { estimatedReach?: number | null }
): { reach: number; estimated: boolean } {
  const storedReach = coalesceIgMetric(post.reach);
  if (storedReach > 0) return { reach: storedReach, estimated: false };
  const views = coalesceIgMetric(post.views);
  if (views > 0) return { reach: views, estimated: false };
  const estimated = opts?.estimatedReach;
  if (estimated != null && estimated > 0) {
    return { reach: Math.round(estimated), estimated: true };
  }
  return { reach: 0, estimated: false };
}

/** Engagement score for a post — stored value or derived from likes/comments when reach was missing at sync. */
export function resolvePostEngagementScore(
  post: IgPostRow,
  opts?: { estimatedReach?: number | null }
): number | null {
  const stored = toFiniteRate(post.engagement_score);
  if (stored != null && stored > 0) return stored;
  const likes = post.likes ?? 0;
  const comments = post.comments ?? 0;
  const shares = post.shares ?? 0;
  const saved = post.saved ?? 0;
  const reach = coalesceIgMetric(post.reach);
  const views = coalesceIgMetric(post.views);
  const direct = computePostEngagementScore({
    likes,
    comments,
    shares,
    saved,
    reach,
    views: views > 0 ? views : undefined,
  });
  if (direct != null) return direct;
  const estimatedReach = opts?.estimatedReach;
  if (estimatedReach != null && estimatedReach > 0) {
    return computePostEngagementScore({
      likes,
      comments,
      shares,
      saved,
      reach: estimatedReach,
    });
  }
  return null;
}

/**
 * Account-level engagement from daily rows.
 *
 * ClarioSuite often omits `series.interactions` (sync historically stored 0 / 0%),
 * so we ignore non-positive rates unless there are real interactions to back them up.
 * Callers should pass the result through `resolveEngagementRate` for top-post fallback.
 */
export function summarizeIgDaily(daily: IgDailyRow[], opts?: { periodViews?: number | null }) {
  const reach = daily.reduce((s, d) => s + coalesceIgMetric(d.reach), 0);
  const viewsRaw = daily.reduce((s, d) => s + coalesceIgMetric(d.views), 0);
  const views = resolveViewsTotal(daily, opts);
  // Only count interactions on days with reach — avoids inflated ER when sync gaps store 0 reach
  // but still report interactions (e.g. Frika Aug 19–20 partial week).
  const interactions = daily.reduce((s, d) => {
    const dayReach = coalesceIgMetric(d.reach);
    if (dayReach <= 0) return s;
    return s + coalesceIgMetric(d.total_interactions);
  }, 0);
  // Period-level ER (Σ interactions ÷ Σ reach) — never average daily rates (Lina Aug 12 spike).
  let avgEr: number | null = null;
  if (reach > 0 && interactions > 0) {
    avgEr = (interactions / reach) * 100;
  } else {
    const erDays = daily.filter((d) => {
      const rate = toFiniteRate(d.engagement_rate);
      return rate != null && (rate > 0 || coalesceIgMetric(d.total_interactions) > 0);
    });
    avgEr =
      erDays.length > 0
        ? erDays.reduce((s, d) => s + (toFiniteRate(d.engagement_rate) ?? 0), 0) / erDays.length
        : null;
  }
  const withFollowers = daily.filter((d) => d.follower_count != null && d.follower_count > 0);
  const followerStart = withFollowers[0]?.follower_count ?? null;
  const followerEnd = withFollowers[withFollowers.length - 1]?.follower_count ?? null;
  const followerDelta =
    followerStart != null && followerEnd != null ? followerEnd - followerStart : null;
  return {
    reach,
    views,
    views_raw: viewsRaw,
    total_interactions: interactions,
    avg_engagement_rate: avgEr,
    follower_start: followerStart,
    follower_end: followerEnd,
    follower_delta: followerDelta,
  };
}

/**
 * Inclusive calendar-day length of an Athens YMD range.
 * Used to map this_week / this_month onto ClarioSuite `?range=N` (trailing N days).
 */
export function inclusiveYmdDayCount(startYmd: string, endYmd: string): number {
  const start = startYmd.slice(0, 10);
  const end = endYmd.slice(0, 10);
  const startMs = Date.parse(`${start}T12:00:00Z`);
  const endMs = Date.parse(`${end}T12:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || end < start) return 0;
  return Math.round((endMs - startMs) / 86_400_000) + 1;
}

/**
 * If `startYmd`–`endYmd` is a contiguous trailing window ending today or yesterday
 * (Athens), return the day count to pass to ClarioSuite GET /insights?range=N.
 * Otherwise null — API totals are trailing-only and must not be applied to last_month/custom.
 */
export function trailingClarioSuiteRangeDays(
  startYmd: string,
  endYmd: string,
  todayYmd = getTodayYmdAthens()
): number | null {
  const start = startYmd.slice(0, 10);
  const end = endYmd.slice(0, 10);
  const yesterday = addDaysAthensYmd(todayYmd, -1);
  if (end !== todayYmd && end !== yesterday) return null;
  const days = inclusiveYmdDayCount(start, end);
  if (days < CLARIOSUITE_MIN_INSIGHTS_RANGE || days > CLARIOSUITE_MAX_INSIGHTS_RANGE) return null;
  if (addDaysAthensYmd(end, -(days - 1)) !== start) return null;
  return days;
}

/** True when some reach days have no daily views — Meta/ClarioSuite often omit views beyond ~2 weeks. */
export function igDailyViewsSeriesIncomplete(daily: IgDailyRow[]): boolean {
  let reachDays = 0;
  let viewDays = 0;
  for (const d of daily) {
    if (coalesceIgMetric(d.reach) > 0) reachDays += 1;
    if (coalesceIgMetric(d.views) > 0) viewDays += 1;
  }
  return reachDays > 0 && viewDays > 0 && viewDays < reachDays;
}

/** Sum views, or null when Meta/ClarioSuite hasn't reported views yet (reach exists, all views 0). */
export function resolveViewsTotal(
  daily: IgDailyRow[],
  opts?: { periodViews?: number | null }
): number | null {
  const period = opts?.periodViews;
  if (period != null && Number.isFinite(period) && period > 0) {
    return Math.round(period);
  }
  if (!daily.length) return null;
  const total = daily.reduce((s, d) => s + coalesceIgMetric(d.views), 0);
  const reach = daily.reduce((s, d) => s + coalesceIgMetric(d.reach), 0);
  if (total > 0 && igDailyViewsSeriesIncomplete(daily)) return null;
  if (total > 0) return total;
  if (reach > 0) return null;
  return 0;
}

/** Mean post engagement score % (likes+comments+shares+saved ÷ reach × 100). */
export function averagePostEngagementScore(
  posts: IgPostRow[],
  opts?: { startYmd?: string; endYmd?: string; estimatedReach?: number | null }
): number | null {
  const start = opts?.startYmd?.slice(0, 10);
  const end = opts?.endYmd?.slice(0, 10);
  const scores: number[] = [];
  for (const p of posts) {
    const score = resolvePostEngagementScore(p, { estimatedReach: opts?.estimatedReach });
    if (score == null || !(score > 0)) continue;
    if (start || end) {
      const ymd = (p.posted_at ?? "").slice(0, 10);
      if (!ymd) continue;
      if (start && ymd < start) continue;
      if (end && ymd > end) continue;
    }
    scores.push(score);
  }
  if (!scores.length) return null;
  return scores.reduce((s, n) => s + n, 0) / scores.length;
}

/**
 * Single engagement-rate path for per-model totals, Compare leaderboard, and Overview avg.
 * Prefer account daily ER; when missing (common when interactions series is empty), use
 * mean top-post engagement in range so UI never shows a fake 0.00%.
 */
export function resolveEngagementRate(
  dailyAvg: number | null | undefined,
  posts: IgPostRow[],
  opts?: { startYmd?: string; endYmd?: string; daily?: IgDailyRow[] }
): number | null {
  const rate = toFiniteRate(dailyAvg);
  if (rate != null && rate > 0) return rate;
  const estimatedReach = opts?.daily ? avgDailyReach(opts.daily) : null;
  return averagePostEngagementScore(posts, { ...opts, estimatedReach });
}

/** Best post engagement % in range — shared by Model Leaderboard and Compare Models. */
export function resolveTopPostEngagementInRange(
  posts: IgPostRow[],
  range?: IgEngagementRange,
  daily?: IgDailyRow[]
): number | null {
  const estimatedReach = daily ? avgDailyReach(daily) : null;
  let best: number | null = null;
  for (const p of posts) {
    if (range && !postInRangeYmd(p.posted_at, range.startYmd, range.endYmd)) continue;
    const score = resolvePostEngagementScore(p, { estimatedReach });
    if (score == null || !(score > 0)) continue;
    if (best == null || score > best) best = score;
  }
  return best;
}

export type IgEngagementRange = { startYmd: string; endYmd: string };

/** Account totals with engagement rate resolved through the shared path above. */
export function computeModelEngagementTotals(
  daily: IgDailyRow[],
  posts: IgPostRow[],
  range?: IgEngagementRange,
  opts?: { periodViews?: number | null }
) {
  const summary = summarizeIgDaily(daily, opts);
  return {
    ...summary,
    avg_engagement_rate: resolveEngagementRate(summary.avg_engagement_rate, posts, {
      ...range,
      daily,
    }),
  };
}

/** Shorthand for the resolved account engagement rate % in a date range. */
export function computeModelEngagementRate(
  daily: IgDailyRow[],
  posts: IgPostRow[],
  range?: IgEngagementRange
): number | null {
  return computeModelEngagementTotals(daily, posts, range).avg_engagement_rate;
}

export type LinkedIgModel = {
  modelRecordId: string;
  modelName: string;
  igUserId: string;
  accountCount?: number;
  /** Every linked IG user id for this model (multi-account bucket matching). */
  allIgUserIds?: string[];
};

export type IgDailyInsightRow = IgDailyRow & {
  ig_user_id?: string;
  model_record_id?: string | null;
};

/** Combine daily rows from multiple IG accounts (same model) by date.
 * Reach / views / interactions are summed (additive volume).
 * Followers are also summed for that calendar day = total across linked accounts,
 * not a single Instagram profile. Callers that want "current followers" should
 * prefer audience snapshots (per account or summed with an explicit label).
 */
export function aggregateIgDailyByDate(rows: IgDailyInsightRow[]): IgDailyRow[] {
  const byDate = new Map<string, IgDailyRow>();
  for (const row of rows) {
    const date = row.date.slice(0, 10);
    const rowReach = coalesceIgMetric(row.reach);
    const rowViews = coalesceIgMetric(row.views);
    const rowInteractions = coalesceIgMetric(row.total_interactions);
    const hit = byDate.get(date);
    if (!hit) {
      byDate.set(date, {
        date,
        reach: rowReach,
        views: rowViews,
        total_interactions: rowInteractions,
        follower_count: row.follower_count,
        engagement_rate: toFiniteRate(row.engagement_rate),
      });
      continue;
    }
    hit.reach += rowReach;
    hit.views += rowViews;
    hit.total_interactions += rowInteractions;
    if (row.follower_count != null) {
      hit.follower_count = (hit.follower_count ?? 0) + row.follower_count;
    }
    hit.engagement_rate =
      hit.reach > 0 && hit.total_interactions > 0
        ? (hit.total_interactions / hit.reach) * 100
        : hit.engagement_rate;
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export type ModelComparisonRow = {
  modelId: string;
  modelName: string;
  accountCount: number;
  reach: number;
  views: number | null;
  avg_engagement_rate: number | null;
  follower_start: number | null;
  follower_end: number | null;
  follower_delta: number | null;
  growth_rate_pct: number | null;
  top_post_engagement: number | null;
  consistency_score: number | null;
  posting_frequency: number | null;
  days: number;
};

/**
 * Per-model leaderboard rows — buckets daily rows by ig_user_id (canonical ClarioSuite key)
 * with model_record_id fallback, then uses computeModelEngagementTotals for every ER cell.
 */
export function buildModelComparisonRows(
  linked: LinkedIgModel[],
  allDaily: IgDailyInsightRow[],
  postsByModel: Map<string, IgPostRow[]>,
  range?: IgEngagementRange,
  periodViewsByModel?: Map<string, number | null>
): ModelComparisonRow[] {
  const byIgUserId = new Map<string, LinkedIgModel>();
  const byModelRecordId = new Map(linked.map((m) => [m.modelRecordId, m]));
  for (const m of linked) {
    byIgUserId.set(m.igUserId, m);
    for (const id of m.allIgUserIds ?? []) {
      byIgUserId.set(id, m);
    }
  }
  // Also index secondary accounts when caller passes expanded ig ids via linked list
  const buckets = new Map<string, { model: LinkedIgModel; rows: IgDailyInsightRow[] }>();

  for (const m of linked) {
    buckets.set(m.modelRecordId, { model: m, rows: [] });
  }

  for (const row of allDaily) {
    const match =
      (row.ig_user_id ? byIgUserId.get(row.ig_user_id) : undefined) ??
      (row.model_record_id ? byModelRecordId.get(row.model_record_id) : undefined);
    if (!match) continue;
    buckets.get(match.modelRecordId)!.rows.push({
      ...row,
      engagement_rate: toFiniteRate(row.engagement_rate),
    });
  }

  return [...buckets.values()].map(({ model, rows }) => {
    const aggregated = aggregateIgDailyByDate(rows);
    const posts =
      postsByModel.get(model.modelRecordId) ??
      postsByModel.get(model.igUserId) ??
      [];
    const totals = computeModelEngagementTotals(aggregated, posts, range, {
      periodViews: periodViewsByModel?.get(model.modelRecordId) ?? null,
    });
    const freq = postingFrequency(posts, range?.startYmd ?? "", range?.endYmd ?? "");
    const topEng = resolveTopPostEngagementInRange(posts, range, aggregated);
    return {
      modelId: model.modelRecordId,
      modelName: model.modelName,
      accountCount: (model as LinkedIgModel & { accountCount?: number }).accountCount ?? 1,
      reach: totals.reach,
      views: totals.views,
      avg_engagement_rate: toFiniteRate(totals.avg_engagement_rate),
      follower_start: totals.follower_start,
      follower_end: totals.follower_end,
      follower_delta: totals.follower_delta,
      growth_rate_pct: followerGrowthRatePct(totals.follower_start, totals.follower_delta),
      top_post_engagement: topEng,
      consistency_score: igConsistencyScore(aggregated),
      posting_frequency: freq.posts_per_week,
      days: aggregated.length,
    };
  });
}

/** Agency Overview “Avg Engagement” — mean of per-model resolved rates, never a parallel formula. */
export function computeAgencyAvgEngagementRate(
  comparison: Array<{ avg_engagement_rate: number | null }>,
  agencyDaily: IgDailyRow[],
  allPosts: IgPostRow[],
  range: IgEngagementRange
): number | null {
  const erModels = comparison.filter(
    (c) => c.avg_engagement_rate != null && c.avg_engagement_rate > 0
  );
  if (erModels.length > 0) {
    return erModels.reduce((s, c) => s + (c.avg_engagement_rate ?? 0), 0) / erModels.length;
  }
  return computeModelEngagementRate(agencyDaily, allPosts, range);
}

/** Follower growth rate % over the period (requires start > 0). */
export function followerGrowthRatePct(
  followerStart: number | null | undefined,
  followerDelta: number | null | undefined
): number | null {
  if (followerStart == null || followerDelta == null || !(followerStart > 0)) return null;
  return (followerDelta / followerStart) * 100;
}

/**
 * Prior range of equal length immediately before `startYmd`.
 * Used for WoW / MoM-style callouts without inventing calendar week boundaries.
 */
export function priorEqualLengthRange(
  startYmd: string,
  endYmd: string
): { startYmd: string; endYmd: string; days: number } {
  const start = startYmd.slice(0, 10);
  const end = endYmd.slice(0, 10);
  const startMs = Date.parse(`${start}T12:00:00Z`);
  const endMs = Date.parse(`${end}T12:00:00Z`);
  const days =
    Number.isFinite(startMs) && Number.isFinite(endMs)
      ? Math.max(1, Math.round((endMs - startMs) / 86_400_000) + 1)
      : 1;
  const priorEnd = addDaysAthensYmd(start, -1);
  const priorStart = addDaysAthensYmd(priorEnd, -(days - 1));
  return { startYmd: priorStart, endYmd: priorEnd, days };
}

/** Whether growth rate is accelerating vs prior period. */
export function growthMomentum(
  currentRate: number | null,
  priorRate: number | null
): "accelerating" | "decelerating" | "steady" | null {
  if (currentRate == null || priorRate == null) return null;
  const delta = currentRate - priorRate;
  if (Math.abs(delta) < 0.15) return "steady";
  return delta > 0 ? "accelerating" : "decelerating";
}

/** Consistency of daily reach (same CV→0–100 formula as Chatter Performance). */
export function igConsistencyScore(daily: IgDailyRow[]): number | null {
  const activeDays = daily.filter((d) => coalesceIgMetric(d.reach) > 0);
  if (!daily.length) return null;
  // Scale threshold for short presets (e.g. this_month mid-month) but never below 7 days.
  const threshold = Math.min(IG_MIN_CONSISTENCY_DAYS, Math.max(7, daily.length));
  if (activeDays.length < threshold) return null;
  return computeConsistencyScore(activeDays.map((d) => coalesceIgMetric(d.reach)));
}

/** Follower trend points for charts — excludes reconstructed 0 placeholders before history exists. */
export function buildFollowerTrendSeries(
  daily: IgDailyRow[]
): { points: IgDailyRow[]; buildingHistory: boolean } {
  const points = daily.filter((d) => d.follower_count != null && d.follower_count > 0);
  const buildingHistory = points.length > 0 && points.length < IG_MIN_FOLLOWER_TREND_POINTS;
  return { points, buildingHistory };
}

export function postInRangeYmd(
  postedAt: string | null | undefined,
  startYmd: string,
  endYmd: string
): boolean {
  if (!postedAt) return false;
  const ymd = postedAt.slice(0, 10);
  if (!ymd) return false;
  const start = startYmd.slice(0, 10);
  const end = endYmd.slice(0, 10);
  return ymd >= start && ymd <= end;
}

export type ContentTypePerf = {
  group: IgPostGroup;
  label: string;
  count: number;
  avg_engagement: number | null;
  avg_reach: number | null;
};

export function contentTypePerformance(
  posts: IgPostRow[],
  opts?: { startYmd?: string; endYmd?: string; daily?: IgDailyRow[] }
): ContentTypePerf[] {
  const buckets: Record<IgPostGroup, { postCount: number; scores: number[]; reaches: number[] }> = {
    reels: { postCount: 0, scores: [], reaches: [] },
    carousels: { postCount: 0, scores: [], reaches: [] },
    posts: { postCount: 0, scores: [], reaches: [] },
  };
  const start = opts?.startYmd?.slice(0, 10);
  const end = opts?.endYmd?.slice(0, 10);
  const estimatedReach = opts?.daily ? avgDailyReach(opts.daily) : null;
  for (const p of posts) {
    if (start && end && !postInRangeYmd(p.posted_at, start, end)) continue;
    const g = classifyIgPost({
      mediaType: p.media_type,
      mediaProductType: p.media_product_type,
    });
    buckets[g].postCount += 1;
    const score = resolvePostEngagementScore(p, { estimatedReach });
    if (score != null && score > 0) {
      buckets[g].scores.push(score);
    }
    const reach = coalesceIgMetric(p.reach);
    if (reach > 0) {
      buckets[g].reaches.push(reach);
    }
  }
  const labels: Record<IgPostGroup, string> = {
    reels: "Reels",
    carousels: "Carousels",
    posts: "Posts",
  };
  return (["reels", "carousels", "posts"] as IgPostGroup[]).map((group) => {
    const b = buckets[group];
    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : null;
    return {
      group,
      label: labels[group],
      count: b.postCount,
      avg_engagement: avg(b.scores),
      avg_reach: avg(b.reaches),
    };
  });
}

export type PostingFrequency = {
  posts_in_range: number;
  days_in_range: number;
  posts_per_week: number | null;
  posts_per_day: number | null;
};

export function postingFrequency(
  posts: IgPostRow[],
  startYmd: string,
  endYmd: string
): PostingFrequency {
  const start = startYmd.slice(0, 10);
  const end = endYmd.slice(0, 10);
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T23:59:59Z`);
  const days =
    Number.isFinite(startMs) && Number.isFinite(endMs)
      ? Math.max(1, Math.round((endMs - startMs) / 86_400_000) + 1)
      : 1;
  let count = 0;
  for (const p of posts) {
    if (!p.posted_at) continue;
    const t = Date.parse(p.posted_at);
    if (!Number.isFinite(t)) continue;
    if (t >= startMs && t <= endMs) count += 1;
  }
  return {
    posts_in_range: count,
    days_in_range: days,
    posts_per_day: days > 0 ? count / days : null,
    posts_per_week: days > 0 ? (count / days) * 7 : null,
  };
}

/**
 * Build daily post counts (from dated posts) joined with daily reach for an
 * observational correlation chart. Does not imply causation.
 */
export function postingVsReachSeries(
  posts: IgPostRow[],
  daily: IgDailyRow[],
  startYmd: string,
  endYmd: string
): Array<{ date: string; posts: number; reach: number; engagement_rate: number | null }> {
  const start = startYmd.slice(0, 10);
  const end = endYmd.slice(0, 10);
  const byDate = new Map<string, { posts: number; reach: number; engagement_rate: number | null }>();
  for (const d of daily) {
    if (d.date < start || d.date > end) continue;
    byDate.set(d.date, {
      posts: 0,
      reach: d.reach,
      engagement_rate: d.engagement_rate,
    });
  }
  for (const p of posts) {
    if (!p.posted_at) continue;
    const ymd = p.posted_at.slice(0, 10);
    if (ymd < start || ymd > end) continue;
    const row = byDate.get(ymd);
    if (row) row.posts += 1;
    else byDate.set(ymd, { posts: 1, reach: 0, engagement_rate: null });
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));
}

/** Pearson r for paired series; null if insufficient variance / points. */
export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < IG_MIN_CORRELATION_DAYS) return null;
  const postDays = xs.filter((x) => x > 0).length;
  if (postDays < IG_MIN_CORRELATION_POST_DAYS) return null;
  const reachDays = ys.filter((y) => y > 0).length;
  if (reachDays < IG_MIN_CONSISTENCY_DAYS) return null;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i]!;
    sy += ys[i]!;
  }
  const mx = sx / n;
  const my = sy / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i]! - mx;
    const b = ys[i]! - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (!(dx > 0) || !(dy > 0)) return null;
  return num / Math.sqrt(dx * dy);
}

export type CompareCallout = {
  kind: "improved" | "declining";
  modelId: string;
  modelName: string;
  metric: "reach" | "engagement" | "growth_rate";
  current: number;
  prior: number;
  deltaPct: number | null;
  message: string;
};

export function buildCompareCallouts(
  current: Array<{
    modelId: string;
    modelName: string;
    reach: number;
    avg_engagement_rate: number | null;
    growth_rate_pct: number | null;
  }>,
  prior: Array<{
    modelId: string;
    modelName: string;
    reach: number;
    avg_engagement_rate: number | null;
    growth_rate_pct: number | null;
  }>
): CompareCallout[] {
  const priorMap = new Map(prior.map((p) => [p.modelId, p]));
  type Candidate = CompareCallout & { score: number };
  const improved: Candidate[] = [];
  const declining: Candidate[] = [];

  for (const c of current) {
    const p = priorMap.get(c.modelId);
    if (!p) continue;

    if (c.growth_rate_pct != null && p.growth_rate_pct != null) {
      const delta = c.growth_rate_pct - p.growth_rate_pct;
      const row: Candidate = {
        kind: delta >= 0 ? "improved" : "declining",
        modelId: c.modelId,
        modelName: c.modelName,
        metric: "growth_rate",
        current: c.growth_rate_pct,
        prior: p.growth_rate_pct,
        deltaPct: delta,
        score: Math.abs(delta),
        message:
          delta >= 0
            ? `${c.modelName} accelerated follower growth vs the prior period — keep the momentum.`
            : `${c.modelName}'s growth rate cooled vs the prior period — worth a closer look at cadence and content mix.`,
      };
      (delta >= 0 ? improved : declining).push(row);
    } else if (p.reach > 0) {
      const deltaPct = ((c.reach - p.reach) / p.reach) * 100;
      const row: Candidate = {
        kind: deltaPct >= 0 ? "improved" : "declining",
        modelId: c.modelId,
        modelName: c.modelName,
        metric: "reach",
        current: c.reach,
        prior: p.reach,
        deltaPct,
        score: Math.abs(deltaPct),
        message:
          deltaPct >= 0
            ? `${c.modelName} lifted reach vs the prior period — strong period-over-period progress.`
            : `${c.modelName}'s reach dipped vs the prior period — check posting rhythm and top formats.`,
      };
      (deltaPct >= 0 ? improved : declining).push(row);
    }
  }

  improved.sort((a, b) => b.score - a.score);
  declining.sort((a, b) => b.score - a.score);
  const out: CompareCallout[] = [];
  if (improved[0]) {
    const { score: _s, ...rest } = improved[0];
    out.push(rest);
  }
  if (declining[0] && declining[0].modelId !== improved[0]?.modelId) {
    const { score: _s, ...rest } = declining[0];
    out.push(rest);
  }
  return out;
}

export type CompareChartMetricId =
  | "reach"
  | "engagement"
  | "growth"
  | "posting"
  | "consistency";

export type NormalizedCompareChartRow = {
  metric: string;
  metricId: CompareChartMetricId;
  [modelName: string]: string | number;
};

/** Grouped bar chart rows — each metric normalized 0–100 across selected models. */
export function buildNormalizedCompareChartData(
  rows: ModelComparisonRow[],
  selectedIds: string[],
  maxModels = 6
): NormalizedCompareChartRow[] {
  const selected = rows.filter((r) => selectedIds.includes(r.modelId)).slice(0, maxModels);
  if (!selected.length) return [];

  const maxReach = Math.max(...selected.map((r) => r.reach), 1);
  const maxEr = Math.max(...selected.map((r) => r.avg_engagement_rate ?? 0), 0.01);
  const maxGrowth = Math.max(...selected.map((r) => Math.abs(r.growth_rate_pct ?? 0)), 0.01);
  const maxPosting = Math.max(...selected.map((r) => r.posting_frequency ?? 0), 0.01);
  const maxConsistency = Math.max(...selected.map((r) => r.consistency_score ?? 0), 1);

  const metrics: Array<{
    metricId: CompareChartMetricId;
    label: string;
    pick: (r: ModelComparisonRow) => number | null;
    max: number;
    shift?: boolean;
  }> = [
    { metricId: "reach", label: "Reach", pick: (r) => r.reach, max: maxReach },
    { metricId: "engagement", label: "Engagement", pick: (r) => r.avg_engagement_rate, max: maxEr },
    {
      metricId: "growth",
      label: "Growth",
      pick: (r) => r.growth_rate_pct,
      max: maxGrowth,
      shift: true,
    },
    {
      metricId: "posting",
      label: "Posts/wk",
      pick: (r) => r.posting_frequency,
      max: maxPosting,
    },
    {
      metricId: "consistency",
      label: "Consistency",
      pick: (r) => r.consistency_score,
      max: maxConsistency,
    },
  ];

  return metrics.map(({ metricId, label, pick, max, shift }) => {
    const point: NormalizedCompareChartRow = { metric: label, metricId };
    for (const r of selected) {
      const raw = pick(r);
      if (raw == null) {
        point[r.modelName] = 0;
        continue;
      }
      const v = shift ? raw + max : raw;
      const denom = shift ? 2 * max : max;
      point[r.modelName] = Math.round(Math.min(100, Math.max(0, (v / denom) * 100)) * 10) / 10;
    }
    return point;
  });
}

export type CompareFieldReason =
  | "no_views"
  | "no_followers"
  | "no_growth"
  | "no_posts"
  | "insufficient_reach_days"
  | "no_post_reach";

export function compareFieldReason(
  row: ModelComparisonRow,
  field:
    | "views"
    | "follower_end"
    | "follower_delta"
    | "growth_rate_pct"
    | "posting_frequency"
    | "consistency_score"
    | "top_post_engagement"
): CompareFieldReason | null {
  if (field === "views") {
    if (row.views == null && row.reach > 0) return "no_views";
    return null;
  }
  if (field === "follower_end" || field === "follower_delta") {
    if (row.follower_end == null) return "no_followers";
    return null;
  }
  if (field === "growth_rate_pct") {
    if (row.growth_rate_pct == null) return "no_growth";
    return null;
  }
  if (field === "posting_frequency") {
    if (row.posting_frequency == null) return "no_posts";
    return null;
  }
  if (field === "consistency_score") {
    if (row.consistency_score == null && row.days > 0) return "insufficient_reach_days";
    return null;
  }
  if (field === "top_post_engagement") {
    if (row.top_post_engagement == null) return "no_post_reach";
    return null;
  }
  return null;
}

export const COMPARE_FIELD_REASON_LABELS: Record<CompareFieldReason, string> = {
  no_views: "Views not reported yet",
  no_followers: "No follower history",
  no_growth: "Need start + end followers",
  no_posts: "No posts in range",
  insufficient_reach_days: "Need 14+ reach days",
  no_post_reach: "No post reach in cache",
};
