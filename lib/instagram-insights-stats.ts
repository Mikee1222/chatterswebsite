/**
 * Pure Instagram Insights stats helpers (agency overview, compare, consistency).
 */

import { addDaysAthensYmd } from "@/lib/airtable-datetime";
import { classifyIgPost, type IgPostGroup } from "@/lib/instagram-insights-ui";
import { computeConsistencyScore } from "@/services/infloww-analytics";

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
  posted_at?: string | null;
};

export function summarizeIgDaily(daily: IgDailyRow[]) {
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
  return computeConsistencyScore(daily.map((d) => d.reach));
}

export type ContentTypePerf = {
  group: IgPostGroup;
  label: string;
  count: number;
  avg_engagement: number | null;
  avg_reach: number | null;
};

export function contentTypePerformance(posts: IgPostRow[]): ContentTypePerf[] {
  const buckets: Record<IgPostGroup, { scores: number[]; reaches: number[] }> = {
    reels: { scores: [], reaches: [] },
    carousels: { scores: [], reaches: [] },
    posts: { scores: [], reaches: [] },
  };
  for (const p of posts) {
    const g = classifyIgPost({
      mediaType: p.media_type,
      mediaProductType: p.media_product_type,
    });
    if (p.engagement_score != null && Number.isFinite(p.engagement_score)) {
      buckets[g].scores.push(p.engagement_score);
    }
    if (p.reach != null && Number.isFinite(p.reach) && p.reach > 0) {
      buckets[g].reaches.push(p.reach);
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
      count: Math.max(b.scores.length, b.reaches.length),
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
  if (n < 5) return null;
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
