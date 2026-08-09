/**
 * Cross-platform analytics: Instagram Insights (ClarioSuite) × Infloww Earnings.
 * Pure derive + thin loader — no sync logic. Correlation ≠ causation in all copy.
 */

import { resolveEngagementRate, summarizeIgDaily } from "@/lib/instagram-insights-stats";
import {
  queryClarioSuiteDailyInsights,
  queryClarioSuiteTopPosts,
} from "@/services/clariosuite-sync";
import {
  listCreatorDailyStats,
  listCreatorTransactions,
  type CreatorDailyStatsRow,
  type CreatorTransactionRow,
} from "@/services/infloww-creator-earnings";
import { previousPeriodRange } from "@/services/infloww-analytics";

const CORRELATION_MIN_DAYS = 5;
const GROWTH_SCORE_MIN_DAYS = 3;
const CONTENT_POSTS_LIMIT = 6;

type IgDailyRow = {
  date: string;
  reach: number;
  views: number;
  total_interactions: number;
  follower_count: number | null;
  engagement_rate: number | null;
};

type TopPostRow = {
  media_id: string;
  permalink: string | null;
  caption: string | null;
  image_url: string | null;
  engagement_score: number | null;
  reach: number;
  posted_at: string | null;
  rank: number;
};

export type CrossPlatformStatus =
  | "ready"
  | "sparse"
  | "ig_only"
  | "of_only"
  | "unlinked";

export type CorrelationStrength = "strong" | "moderate" | "weak" | "none";

export type CrossPlatformDayPoint = {
  date: string;
  reach: number;
  views: number;
  profile_visitors: number;
  new_subscribers: number;
  ig_follower_count: number | null;
  ig_follower_delta: number | null;
  of_revenue: number;
};

export type ContentConversionWindow = {
  media_id: string;
  caption: string | null;
  posted_at: string;
  posted_ymd: string;
  image_url: string | null;
  permalink: string | null;
  rank: number;
  reach: number;
  before_24h: { new_subs: number; revenue: number };
  after_24h: { new_subs: number; revenue: number };
  after_48h: { new_subs: number; revenue: number };
  after_72h: { new_subs: number; revenue: number };
  /** Positive when after_72h new_subs > before_24h — descriptive only. */
  lift_hint: "up" | "down" | "flat" | "na";
};

export type CrossPlatformAnalytics = {
  model_record_id: string;
  model_name: string | null;
  range: { startYmd: string; endYmd: string };
  status: CrossPlatformStatus;
  status_message: string;
  overlap_days: number;
  ig_days: number;
  of_days: number;

  reach_visitor_correlation: {
    available: boolean;
    sample_size: number;
    correlation: number | null;
    strength: CorrelationStrength | null;
    note: string;
  };

  growth_alignment: {
    available: boolean;
    series: Array<{
      date: string;
      ig_follower_delta: number | null;
      of_new_subscribers: number;
    }>;
    ig_follower_delta_total: number | null;
    of_new_subscribers_total: number;
    note: string;
  };

  content_conversion: {
    available: boolean;
    windows: ContentConversionWindow[];
    note: string;
  };

  conversion_estimate: {
    available: boolean;
    /** Rough new OF subs ÷ IG reach × 100. ESTIMATE only. */
    rate_pct: number | null;
    total_reach: number;
    total_new_subs: number;
    label: "ESTIMATE";
    note: string;
  };

  growth_score: {
    available: boolean;
    score: number | null;
    label: string;
    components: {
      ig_engagement: number | null;
      ig_follower_trend: number | null;
      of_sub_trend: number | null;
      of_revenue_trend: number | null;
    };
    note: string;
  };

  /** Infloww has no comparable age/gender/country demos — always skipped. */
  audience_overlap: {
    available: false;
    skipped: true;
    reason: string;
  };

  /** Daily joined series for charts (admin). */
  series: CrossPlatformDayPoint[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function addDaysYmd(ymd: string, days: number): string {
  const parts = ymd.trim().slice(0, 10).split("-").map(Number);
  if (parts.length !== 3) return ymd;
  const d = new Date(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!, 12, 0, 0));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function toYmd(isoOrYmd: string): string {
  return isoOrYmd.trim().slice(0, 10);
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 2 || n !== ys.length) return null;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX;
    const dy = ys[i]! - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  if (den === 0) return null;
  return round2(num / den);
}

function correlationStrength(r: number | null): CorrelationStrength | null {
  if (r == null) return null;
  const a = Math.abs(r);
  if (a >= 0.6) return "strong";
  if (a >= 0.35) return "moderate";
  if (a >= 0.15) return "weak";
  return "none";
}

function revenueByDate(txs: CreatorTransactionRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (!t.created_time) continue;
    const ymd = toYmd(t.created_time);
    map.set(ymd, (map.get(ymd) ?? 0) + (Number.isFinite(t.amount) ? t.amount : 0));
  }
  return map;
}

function sumRange(
  byDate: Map<string, number>,
  startYmd: string,
  endYmd: string
): number {
  let s = 0;
  let cur = startYmd;
  // Cap loop length to avoid runaway
  for (let i = 0; i < 14; i++) {
    if (cur > endYmd) break;
    s += byDate.get(cur) ?? 0;
    cur = addDaysYmd(cur, 1);
  }
  return s;
}

function clamp01to100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Normalize a period-over-period % change into 0–100.
 * +50% → ~83, 0% → 50, −50% → ~17.
 */
function trendToScore(pctChange: number | null, hasData: boolean): number | null {
  if (!hasData || pctChange == null) return null;
  const mapped = 50 + pctChange * 0.66;
  return clamp01to100(mapped);
}

function pctChangeSafe(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function liftHint(
  before: number,
  after: number
): ContentConversionWindow["lift_hint"] {
  if (before === 0 && after === 0) return "flat";
  if (before === 0 && after > 0) return "up";
  if (after === 0 && before > 0) return "down";
  const pct = ((after - before) / Math.max(1, before)) * 100;
  if (Math.abs(pct) < 10) return "flat";
  return pct > 0 ? "up" : "down";
}

function emptyAudienceOverlap(): CrossPlatformAnalytics["audience_overlap"] {
  return {
    available: false,
    skipped: true,
    reason:
      "Infloww does not expose fan age, gender, or country demographics comparable to Instagram audience snapshots — overlap comparison is skipped.",
  };
}

export function deriveCrossPlatformAnalytics(input: {
  modelRecordId: string;
  modelName: string | null;
  startYmd: string;
  endYmd: string;
  igDaily: IgDailyRow[];
  ofDaily: CreatorDailyStatsRow[];
  ofTransactions: CreatorTransactionRow[];
  topPosts: TopPostRow[];
  prevIgDaily?: IgDailyRow[];
  prevOfDaily?: CreatorDailyStatsRow[];
  prevGross?: number;
}): CrossPlatformAnalytics {
  const {
    modelRecordId,
    modelName,
    startYmd,
    endYmd,
    igDaily,
    ofDaily,
    ofTransactions,
    topPosts,
    prevIgDaily = [],
    prevOfDaily = [],
    prevGross,
  } = input;

  const igByDate = new Map(igDaily.map((d) => [d.date, d]));
  const ofByDate = new Map(ofDaily.map((d) => [d.date, d]));
  const revByDate = revenueByDate(ofTransactions);

  const allDates = new Set<string>([...igByDate.keys(), ...ofByDate.keys()]);
  const sortedDates = [...allDates].sort();

  const series: CrossPlatformDayPoint[] = [];
  let prevFollowers: number | null = null;
  for (const date of sortedDates) {
    const ig = igByDate.get(date);
    const of = ofByDate.get(date);
    const fc = ig?.follower_count ?? null;
    let delta: number | null = null;
    if (fc != null && prevFollowers != null) delta = fc - prevFollowers;
    if (fc != null) prevFollowers = fc;
    series.push({
      date,
      reach: ig?.reach ?? 0,
      views: ig?.views ?? 0,
      profile_visitors: of?.profile_visitors ?? 0,
      new_subscribers: of?.new_subscribers ?? 0,
      ig_follower_count: fc,
      ig_follower_delta: delta,
      of_revenue: revByDate.get(date) ?? 0,
    });
  }

  const overlapDates = sortedDates.filter((d) => igByDate.has(d) && ofByDate.has(d));
  const igDays = igDaily.length;
  const ofDays = ofDaily.length;
  const overlapDays = overlapDates.length;

  let status: CrossPlatformStatus;
  let status_message: string;
  if (igDays === 0 && ofDays === 0) {
    status = "unlinked";
    status_message =
      "Not enough combined data yet — link Instagram (ClarioSuite) and Infloww for this model, then sync both sources.";
  } else if (igDays === 0) {
    status = "of_only";
    status_message =
      "OnlyFans (Infloww) data is present, but Instagram Insights aren’t linked or synced for this range yet.";
  } else if (ofDays === 0) {
    status = "ig_only";
    status_message =
      "Instagram Insights are present, but Infloww earnings data isn’t available for this range yet.";
  } else if (overlapDays < CORRELATION_MIN_DAYS) {
    status = "sparse";
    status_message = `Only ${overlapDays} overlapping day${overlapDays === 1 ? "" : "s"} so far — need about ${CORRELATION_MIN_DAYS}+ shared days before patterns are trustworthy.`;
  } else {
    status = "ready";
    status_message =
      "Combined Instagram + OnlyFans data for this range. Patterns below describe alignment — not proven causation.";
  }

  // ── 1. Reach ↔ profile visitors correlation ─────────────────────────────
  const corrXs: number[] = [];
  const corrYs: number[] = [];
  for (const d of overlapDates) {
    const ig = igByDate.get(d)!;
    const of = ofByDate.get(d)!;
    corrXs.push(ig.reach);
    corrYs.push(of.profile_visitors);
  }
  const corr =
    overlapDays >= CORRELATION_MIN_DAYS ? pearson(corrXs, corrYs) : null;
  const strength = correlationStrength(corr);
  let corrNote: string;
  if (overlapDays < CORRELATION_MIN_DAYS) {
    corrNote = `Not enough overlapping days (${overlapDays}/${CORRELATION_MIN_DAYS}) to estimate whether IG reach aligns with OF profile visitors.`;
  } else if (corr == null) {
    corrNote =
      "Reach and visitor variance is too low in this sample to compute a meaningful correlation.";
  } else if (strength === "strong" || strength === "moderate") {
    corrNote =
      corr > 0
        ? `IG daily reach appears to align with OF profile visitors (r=${corr}). This is a pattern in the data — not proof that reach caused visits.`
        : `IG reach and OF visitors moved in opposite directions in this sample (r=${corr}). Treat cautiously — other traffic sources may dominate.`;
  } else {
    corrNote = `Little daily alignment between IG reach and OF profile visitors in this range (r=${corr ?? "—"}). Other channels may drive visits, or the window is noisy.`;
  }

  // ── 2. Growth alignment series ──────────────────────────────────────────
  const growthSeries = series
    .filter((d) => igByDate.has(d.date) || ofByDate.has(d.date))
    .map((d) => ({
      date: d.date,
      ig_follower_delta: d.ig_follower_delta,
      of_new_subscribers: d.new_subscribers,
    }));
  const withFollowers = series.filter((d) => d.ig_follower_count != null);
  const igFollowerDeltaTotal =
    withFollowers.length >= 2
      ? (withFollowers[withFollowers.length - 1]!.ig_follower_count! -
          withFollowers[0]!.ig_follower_count!)
      : null;
  const ofNewSubsTotal = ofDaily.reduce((s, d) => s + d.new_subscribers, 0);
  const growthAvailable = igDays > 0 && ofDays > 0 && growthSeries.length >= 2;
  const growthNote = growthAvailable
    ? "IG follower change and OF new subscribers over the same dates. Lines can move together without one causing the other."
    : "Need both Instagram follower history and Infloww new-subscriber days to show growth alignment.";

  // ── 3. Content → conversion windows ─────────────────────────────────────
  const ofSubsByDate = new Map(ofDaily.map((d) => [d.date, d.new_subscribers]));
  const windows: ContentConversionWindow[] = [];
  for (const post of topPosts) {
    if (!post.posted_at) continue;
    const postedYmd = toYmd(post.posted_at);
    if (postedYmd < startYmd || postedYmd > endYmd) {
      // Still include posts near range if we have OF data around them
      const earliest = addDaysYmd(startYmd, -1);
      const latest = addDaysYmd(endYmd, 3);
      if (postedYmd < earliest || postedYmd > latest) continue;
    }
    const beforeStart = addDaysYmd(postedYmd, -1);
    const after1 = postedYmd; // post day counts as start of "after"
    const after1End = addDaysYmd(postedYmd, 0);
    const after2End = addDaysYmd(postedYmd, 1);
    const after3End = addDaysYmd(postedYmd, 2);

    const before = {
      new_subs: ofSubsByDate.get(beforeStart) ?? 0,
      revenue: revByDate.get(beforeStart) ?? 0,
    };
    const after24 = {
      new_subs: sumRange(ofSubsByDate, after1, after1End),
      revenue: sumRange(revByDate, after1, after1End),
    };
    const after48 = {
      new_subs: sumRange(ofSubsByDate, after1, after2End),
      revenue: sumRange(revByDate, after1, after2End),
    };
    const after72 = {
      new_subs: sumRange(ofSubsByDate, after1, after3End),
      revenue: sumRange(revByDate, after1, after3End),
    };

    windows.push({
      media_id: post.media_id,
      caption: post.caption,
      posted_at: post.posted_at,
      posted_ymd: postedYmd,
      image_url: post.image_url,
      permalink: post.permalink,
      rank: post.rank,
      reach: post.reach,
      before_24h: before,
      after_24h: after24,
      after_48h: after48,
      after_72h: after72,
      lift_hint: liftHint(before.new_subs, after72.new_subs),
    });
  }
  windows.sort((a, b) => a.rank - b.rank);
  const contentAvailable = windows.length > 0 && ofDays > 0;
  const contentNote = contentAvailable
    ? "For each top IG post, OF new subs and revenue in the day before vs 24–72h after. Timing can coincide with other campaigns — read as a window, not proof."
    : "Need top IG posts with timestamps plus Infloww daily data to estimate content-to-conversion windows.";

  // ── 4. Conversion estimate ──────────────────────────────────────────────
  const totalReach = igDaily.reduce((s, d) => s + d.reach, 0);
  const totalNewSubs = ofNewSubsTotal;
  const ratePct =
    totalReach > 0 && ofDays > 0 && igDays > 0
      ? round2((totalNewSubs / totalReach) * 100)
      : null;
  const convAvailable = ratePct != null && overlapDays >= 3;
  let convNote: string;
  if (!convAvailable) {
    convNote =
      "Not enough combined reach + subscriber data yet for a conversion estimate.";
  } else {
    convNote = `ESTIMATE only: new OF subscribers ÷ IG reach × 100 ≈ ${ratePct}%. This is not a true attribution rate — fans can arrive from many channels, and reach isn’t unique across days.`;
  }

  // ── 5. Combined Growth Score (same ER path as Instagram Insights stats) ─
  const prevRange = previousPeriodRange(startYmd, endYmd);
  const curAvgEr = resolveEngagementRate(
    summarizeIgDaily(igDaily).avg_engagement_rate,
    topPosts,
    { startYmd, endYmd }
  );
  const prevAvgEr = resolveEngagementRate(
    summarizeIgDaily(prevIgDaily).avg_engagement_rate,
    topPosts,
    { startYmd: prevRange.startYmd, endYmd: prevRange.endYmd }
  );

  const igEngagementScore =
    curAvgEr == null
      ? null
      : prevAvgEr != null && prevAvgEr > 0
        ? trendToScore(pctChangeSafe(curAvgEr, prevAvgEr), true)
        : // Absolute ER: ~1% → 40, ~3% → 70, ~5%+ → 90
          clamp01to100(30 + curAvgEr * 12);

  const prevFollowersSeries = prevIgDaily.filter((d) => d.follower_count != null);
  const prevFollowerDelta =
    prevFollowersSeries.length >= 2
      ? prevFollowersSeries[prevFollowersSeries.length - 1]!.follower_count! -
        prevFollowersSeries[0]!.follower_count!
      : null;
  const igFollowerTrendScore =
    igFollowerDeltaTotal == null
      ? null
      : prevFollowerDelta != null
        ? trendToScore(pctChangeSafe(igFollowerDeltaTotal, prevFollowerDelta), true)
        : // Absolute growth: map delta onto 0–100 softly
          clamp01to100(50 + igFollowerDeltaTotal / 4);

  const prevNewSubs = prevOfDaily.reduce((s, d) => s + d.new_subscribers, 0);
  const ofSubTrendScore =
    ofDays === 0
      ? null
      : prevOfDaily.length > 0
        ? trendToScore(pctChangeSafe(totalNewSubs, prevNewSubs), true)
        : clamp01to100(40 + Math.min(50, totalNewSubs / 2));

  const curGross = ofTransactions.reduce((s, t) => s + t.amount, 0);
  const ofRevenueTrendScore =
    ofTransactions.length === 0 && (prevGross == null || prevGross === 0)
      ? null
      : prevGross != null
        ? trendToScore(pctChangeSafe(curGross, prevGross), true)
        : clamp01to100(40 + Math.min(40, curGross / 100));

  const componentScores = [
    igEngagementScore,
    igFollowerTrendScore,
    ofSubTrendScore,
    ofRevenueTrendScore,
  ].filter((x): x is number => x != null);

  const growthScoreAvailable =
    componentScores.length >= 2 &&
    igDays >= GROWTH_SCORE_MIN_DAYS &&
    ofDays >= GROWTH_SCORE_MIN_DAYS;
  const growthScore = growthScoreAvailable
    ? clamp01to100(
        componentScores.reduce((a, b) => a + b, 0) / componentScores.length
      )
    : null;

  let growthLabel = "Not enough data";
  if (growthScore != null) {
    if (growthScore >= 75) growthLabel = "Strong combined momentum";
    else if (growthScore >= 55) growthLabel = "Steady combined growth";
    else if (growthScore >= 40) growthLabel = "Mixed / building";
    else growthLabel = "Soft combined period";
  }

  const growthScoreNote = growthScoreAvailable
    ? "Composite of IG engagement & follower trend plus OF subscriber & revenue trend (0–100). Descriptive momentum — not a rank or guarantee."
    : "Need overlapping Instagram and Infloww history to compute a Combined Growth Score.";

  // ── Model-facing encouragement snippet lives in UI from these fields ────

  return {
    model_record_id: modelRecordId,
    model_name: modelName,
    range: { startYmd, endYmd },
    status,
    status_message,
    overlap_days: overlapDays,
    ig_days: igDays,
    of_days: ofDays,
    reach_visitor_correlation: {
      available: corr != null && overlapDays >= CORRELATION_MIN_DAYS,
      sample_size: overlapDays,
      correlation: corr,
      strength,
      note: corrNote,
    },
    growth_alignment: {
      available: growthAvailable,
      series: growthSeries,
      ig_follower_delta_total: igFollowerDeltaTotal,
      of_new_subscribers_total: ofNewSubsTotal,
      note: growthNote,
    },
    content_conversion: {
      available: contentAvailable,
      windows: windows.slice(0, CONTENT_POSTS_LIMIT),
      note: contentNote,
    },
    conversion_estimate: {
      available: convAvailable,
      rate_pct: convAvailable ? ratePct : null,
      total_reach: totalReach,
      total_new_subs: totalNewSubs,
      label: "ESTIMATE",
      note: convNote,
    },
    growth_score: {
      available: growthScoreAvailable,
      score: growthScore,
      label: growthLabel,
      components: {
        ig_engagement: igEngagementScore,
        ig_follower_trend: igFollowerTrendScore,
        of_sub_trend: ofSubTrendScore,
        of_revenue_trend: ofRevenueTrendScore,
      },
      note: growthScoreNote,
    },
    audience_overlap: emptyAudienceOverlap(),
    series,
  };
}

/** Thin loader: fetch both systems for one model + range, then derive. */
export async function getCrossPlatformAnalytics(params: {
  modelRecordId: string;
  modelName?: string | null;
  startYmd: string;
  endYmd: string;
}): Promise<CrossPlatformAnalytics> {
  const prev = previousPeriodRange(params.startYmd, params.endYmd);

  const [igDaily, ofDaily, ofTxs, topPosts, prevIg, prevOf, prevTxs] =
    await Promise.all([
      queryClarioSuiteDailyInsights({
        modelRecordId: params.modelRecordId,
        startYmd: params.startYmd,
        endYmd: params.endYmd,
      }),
      listCreatorDailyStats({
        modelRecordId: params.modelRecordId,
        startYmd: params.startYmd,
        endYmd: params.endYmd,
      }),
      listCreatorTransactions({
        modelRecordId: params.modelRecordId,
        startYmd: params.startYmd,
        endYmd: params.endYmd,
        limit: 2000,
      }),
      queryClarioSuiteTopPosts({
        modelRecordId: params.modelRecordId,
        limit: 10,
      }),
      queryClarioSuiteDailyInsights({
        modelRecordId: params.modelRecordId,
        startYmd: prev.startYmd,
        endYmd: prev.endYmd,
      }),
      listCreatorDailyStats({
        modelRecordId: params.modelRecordId,
        startYmd: prev.startYmd,
        endYmd: prev.endYmd,
      }),
      listCreatorTransactions({
        modelRecordId: params.modelRecordId,
        startYmd: prev.startYmd,
        endYmd: prev.endYmd,
        limit: 2000,
      }),
    ]);

  return deriveCrossPlatformAnalytics({
    modelRecordId: params.modelRecordId,
    modelName: params.modelName ?? igDaily[0]?.model_name ?? ofDaily[0]?.model_name ?? null,
    startYmd: params.startYmd,
    endYmd: params.endYmd,
    igDaily,
    ofDaily,
    ofTransactions: ofTxs,
    topPosts,
    prevIgDaily: prevIg,
    prevOfDaily: prevOf,
    prevGross: prevTxs.reduce((s, t) => s + t.amount, 0),
  });
}

/** Compact payload for model Earnings “IG → OF” card. */
export type ModelCrossPlatformCard = {
  status: CrossPlatformStatus;
  status_message: string;
  growth_score: number | null;
  growth_label: string;
  conversion_estimate_pct: number | null;
  conversion_note: string;
  ig_follower_delta: number | null;
  of_new_subscribers: number;
  alignment_note: string;
  encouraging: boolean;
};

export function toModelCrossPlatformCard(
  analytics: CrossPlatformAnalytics
): ModelCrossPlatformCard {
  const ready = analytics.status === "ready" || analytics.status === "sparse";
  const score = analytics.growth_score.score;
  const conv = analytics.conversion_estimate.rate_pct;
  const encouraging =
    ready &&
    ((score != null && score >= 55) ||
      (analytics.growth_alignment.ig_follower_delta_total != null &&
        analytics.growth_alignment.ig_follower_delta_total > 0 &&
        analytics.growth_alignment.of_new_subscribers_total > 0));

  let alignment_note: string;
  if (!ready) {
    alignment_note = analytics.status_message;
  } else if (encouraging) {
    alignment_note =
      "Your Instagram growth appears to align with OnlyFans subscriber momentum in this period — keep that energy going.";
  } else {
    alignment_note =
      "Instagram and OnlyFans are both tracked here. Combined signals look mixed this period — that’s normal; focus on consistent posting and fan care.";
  }

  return {
    status: analytics.status,
    status_message: analytics.status_message,
    growth_score: score,
    growth_label: analytics.growth_score.label,
    conversion_estimate_pct: conv,
    conversion_note: analytics.conversion_estimate.note,
    ig_follower_delta: analytics.growth_alignment.ig_follower_delta_total,
    of_new_subscribers: analytics.growth_alignment.of_new_subscribers_total,
    alignment_note,
    encouraging,
  };
}
