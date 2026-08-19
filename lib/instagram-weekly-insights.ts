/**
 * Rule-based insight tags + Talking Points for Instagram Weekly Progress (custom 4-week months).
 */

import type {
  PeriodChangeDisplayNote,
  PeriodChangeMetric,
} from "@/services/infloww-analytics";

/** Max % shown before capping (displays as "500%+"). */
export const IG_PCT_DISPLAY_CAP = 500;

/** Min engagement-rate baseline (percentage points, e.g. 0.1 = 0.1%). */
export const IG_MIN_ER_BASELINE_PCT = 0.1;

/** Min reach baseline for meaningful WoW comparisons. */
export const IG_MIN_REACH_BASELINE = 5_000;

/** Min reach baseline for vs-historical when sample is thin. */
export const IG_MIN_HISTORICAL_REACH_BASELINE = 2_000;

/** Min absolute ER change (percentage points) to trust WoW % on tiny baselines. */
export const IG_MIN_ER_ABS_CHANGE_PCT = 0.15;

export type IgMetricKind = "reach" | "engagement_rate" | "count" | "rate";

export type IgGuardedPctResult = {
  pct_change: number | null;
  direction: PeriodChangeMetric["direction"];
  display_note?: PeriodChangeDisplayNote;
  pct_capped?: boolean;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function minBaselineFor(kind: IgMetricKind, historicalSamples?: number): number {
  if (kind === "engagement_rate" || kind === "rate") return IG_MIN_ER_BASELINE_PCT;
  if (kind === "reach") {
    return historicalSamples != null && historicalSamples < 2
      ? IG_MIN_HISTORICAL_REACH_BASELINE
      : IG_MIN_REACH_BASELINE;
  }
  return 1;
}

/** Guard WoW / period % change against near-zero denominators and cap extremes. */
export function guardIgPctChange(
  current: number,
  previous: number,
  kind: IgMetricKind
): IgGuardedPctResult {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return { pct_change: null, direction: "na" };
  }

  if (previous === 0 && current === 0) {
    return { pct_change: null, direction: "flat" };
  }

  const minBaseline = minBaselineFor(kind);

  if (previous <= 0 || previous < minBaseline) {
    const meaningfulCurrent =
      kind === "engagement_rate" || kind === "rate"
        ? current >= IG_MIN_ER_BASELINE_PCT
        : kind === "reach"
          ? current >= IG_MIN_REACH_BASELINE
          : current > 0;
    if (meaningfulCurrent) {
      return { pct_change: null, direction: "up", display_note: "new_activity" };
    }
    if (current === 0) {
      return { pct_change: null, direction: "na" };
    }
    return {
      pct_change: null,
      direction: current > previous ? "up" : "down",
      display_note: "insufficient_baseline",
    };
  }

  const raw = ((current - previous) / Math.abs(previous)) * 100;
  const absDelta = Math.abs(current - previous);

  if (
    (kind === "engagement_rate" || kind === "rate") &&
    absDelta < IG_MIN_ER_ABS_CHANGE_PCT &&
    Math.abs(raw) > IG_PCT_DISPLAY_CAP / 2
  ) {
    return {
      pct_change: null,
      direction: raw > 0 ? "up" : "down",
      display_note: "insufficient_baseline",
    };
  }

  if (Math.abs(raw) > IG_PCT_DISPLAY_CAP) {
    return {
      pct_change: raw > 0 ? IG_PCT_DISPLAY_CAP : -IG_PCT_DISPLAY_CAP,
      direction: raw > 0 ? "up" : "down",
      pct_capped: true,
    };
  }

  const direction: PeriodChangeMetric["direction"] =
    Math.abs(raw) < 0.5 ? "flat" : raw > 0 ? "up" : "down";
  return { pct_change: round2(raw), direction };
}

/** Build a full PeriodChangeMetric with IG sanity guards applied. */
export function igGuardedPeriodChange(
  current: number,
  previous: number,
  kind: IgMetricKind
): PeriodChangeMetric {
  const guard = guardIgPctChange(current, previous, kind);
  return {
    current,
    previous,
    pct_change: guard.pct_change,
    direction: guard.direction,
    display_note: guard.display_note,
    pct_capped: guard.pct_capped,
  };
}

export type IgGuardedBaselinePct = {
  pct: number | null;
  display_note?: PeriodChangeDisplayNote;
  pct_capped?: boolean;
};

/** Guard % above/below a baseline (historical avg, team avg). */
export function guardIgPctVsBaseline(
  current: number,
  baseline: number,
  kind: IgMetricKind,
  opts?: { historicalSamples?: number }
): IgGuardedBaselinePct {
  if (!Number.isFinite(current) || !Number.isFinite(baseline)) {
    return { pct: null };
  }

  const minBaseline = minBaselineFor(kind, opts?.historicalSamples);

  if (baseline < minBaseline) {
    const meaningfulCurrent =
      kind === "engagement_rate" || kind === "rate"
        ? current >= IG_MIN_ER_BASELINE_PCT
        : kind === "reach"
          ? current >= IG_MIN_REACH_BASELINE
          : current > 0;
    if (meaningfulCurrent) {
      return {
        pct: null,
        display_note:
          opts?.historicalSamples != null ? "insufficient_history" : "insufficient_baseline",
      };
    }
    return { pct: null, display_note: "insufficient_baseline" };
  }

  const raw = ((current - baseline) / baseline) * 100;
  const absDelta = Math.abs(current - baseline);

  if (
    (kind === "engagement_rate" || kind === "rate") &&
    absDelta < IG_MIN_ER_ABS_CHANGE_PCT &&
    Math.abs(raw) > 100
  ) {
    return { pct: null, display_note: "insufficient_baseline" };
  }

  if (Math.abs(raw) > IG_PCT_DISPLAY_CAP) {
    return {
      pct: raw > 0 ? IG_PCT_DISPLAY_CAP : -IG_PCT_DISPLAY_CAP,
      pct_capped: true,
    };
  }

  return { pct: round2(raw) };
}

export type IgWeeklyInsightSeverity = "positive" | "neutral" | "warning" | "critical" | "info";

export type IgWeeklyInsightCategory =
  | "reach_trend"
  | "absolute_tier"
  | "engagement"
  | "posting"
  | "growth";

export type IgWeeklyInsightTag = {
  id: string;
  label: string;
  severity: IgWeeklyInsightSeverity;
  category: IgWeeklyInsightCategory;
  /** Lucide icon key for Weekly Progress pills (rendered client-side). */
  icon?: "trending-up" | "trending-down" | "star" | "target" | "message-circle" | "minus" | "alert";
};

/** Max insight pills per model/week — decision-relevant only. */
export const IG_WEEKLY_MAX_INSIGHT_TAGS = 3;

/** Category priority when signals conflict (higher wins). */
const IG_INSIGHT_CATEGORY_PRIORITY: Record<IgWeeklyInsightCategory, number> = {
  reach_trend: 100,
  engagement: 80,
  posting: 60,
  growth: 40,
  absolute_tier: 20,
};

export type IgWeeklyInsightContext = {
  reach: number;
  avg_engagement_rate: number | null;
  follower_delta: number | null;
  posting_frequency: number | null;
  posts_in_week: number;
  /** WoW % change (null when no prior week). */
  reach_wow_pct: number | null;
  engagement_wow_pct: number | null;
  follower_delta_wow_pct: number | null;
  posting_wow_pct: number | null;
  /** Prior-week follower delta for acceleration/deceleration. */
  prior_follower_delta: number | null;
  /** Team reach for this week (peers with reach > 0). */
  team_week_reach: number[];
  /** Team median posts/week among peers with posts. */
  team_median_posting: number | null;
  /** Team median engagement % among peers with ER > 0. */
  team_median_engagement: number | null;
  /** Pearson r for posting vs reach within this week (optional). */
  posting_reach_correlation: number | null;
  /** Highest reach among this model's weeks in the month. */
  is_best_week_in_month?: boolean;
  /** Posting cadence within ~15% of team median with 3+ posts. */
  is_consistent_poster?: boolean;
};

export type IgWeeklyTalkingPointsContext = {
  modelName: string;
  week: number;
  reach: number;
  reach_wow_pct: number | null;
  reach_wow_note?: PeriodChangeDisplayNote;
  reach_wow_capped?: boolean;
  avg_engagement_rate: number | null;
  engagement_wow_pct: number | null;
  engagement_wow_note?: PeriodChangeDisplayNote;
  engagement_wow_capped?: boolean;
  follower_delta: number | null;
  follower_growth_pct: number | null;
  posts_in_week: number;
  posting_frequency: number | null;
  /** % above/below model's historical avg for this week index (null if no history). */
  vs_historical_reach_pct: number | null;
  vs_historical_reach_note?: PeriodChangeDisplayNote;
  vs_historical_reach_capped?: boolean;
  vs_historical_engagement_pct: number | null;
  vs_historical_engagement_note?: PeriodChangeDisplayNote;
  vs_historical_engagement_capped?: boolean;
  /** % above/below team average reach that week. */
  vs_team_reach_pct: number | null;
  vs_team_reach_note?: PeriodChangeDisplayNote;
  vs_team_reach_capped?: boolean;
  vs_team_engagement_pct: number | null;
  vs_team_engagement_note?: PeriodChangeDisplayNote;
  vs_team_engagement_capped?: boolean;
  is_best_week_in_month: boolean;
  top_post_label: string | null;
  cross_platform_note: string | null;
  historical_weeks_sampled: number;
};

function median(nums: number[]): number | null {
  const valid = nums.filter((x) => Number.isFinite(x));
  if (valid.length === 0) return null;
  const s = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${Math.round(n / 1000)}K`;
  if (abs >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

function fmtPctShort(
  n: number | null | undefined,
  opts?: {
    signed?: boolean;
    display_note?: PeriodChangeDisplayNote;
    pct_capped?: boolean;
  }
): string {
  if (opts?.display_note === "new_activity") return "new activity";
  if (
    opts?.display_note === "insufficient_baseline" ||
    opts?.display_note === "insufficient_history"
  ) {
    return "not enough prior data for comparison";
  }
  if (n == null || !Number.isFinite(n)) return "—";
  const capSuffix = opts?.pct_capped ? "+" : "";
  if (opts?.signed === false) return `${Math.abs(n).toFixed(1)}%${capSuffix}`;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%${capSuffix}`;
}

/** Format guarded comparison % for UI badges and talking points. */
export function fmtIgGuardedPct(
  pct: number | null | undefined,
  opts?: {
    display_note?: PeriodChangeDisplayNote;
    pct_capped?: boolean;
    signed?: boolean;
  }
): string {
  if (opts?.display_note === "new_activity") return "New activity";
  if (
    opts?.display_note === "insufficient_baseline" ||
    opts?.display_note === "insufficient_history"
  ) {
    return "Not enough prior data";
  }
  if (pct == null || !Number.isFinite(pct)) return "—";
  const capSuffix = opts?.pct_capped ? "+" : "";
  const sign = opts?.signed === false ? "" : pct > 0 ? "+" : "";
  return `${sign}${Math.abs(pct).toFixed(0)}%${capSuffix}`;
}

/**
 * Format IG→OF subs-per-reach estimate for small rates (0.03% → "0.03%" or "3 subs per 10K reach").
 * Avoids rounding tiny percentages to 0%.
 */
export function fmtIgConversionEstimate(params: {
  rate_pct: number | null | undefined;
  total_reach?: number;
  total_new_subs?: number;
}): string {
  const { rate_pct, total_reach, total_new_subs } = params;
  if (rate_pct == null || !Number.isFinite(rate_pct)) return "—";
  if (rate_pct >= 0.1) {
    return `${rate_pct.toFixed(rate_pct >= 1 ? 1 : 2)}% new subs per 100 IG reach`;
  }
  if (rate_pct > 0) {
    return `${rate_pct.toFixed(2)}% new subs per 100 IG reach`;
  }
  if (
    total_reach != null &&
    total_reach > 0 &&
    total_new_subs != null &&
    total_new_subs > 0
  ) {
    const per10k = (total_new_subs / total_reach) * 10_000;
    if (per10k >= 0.05) {
      const n = per10k < 1 ? per10k.toFixed(2) : per10k.toFixed(1);
      return `${n} subs per 10,000 IG reach`;
    }
  }
  return "—";
}

function fmtErPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n < 1 ? `${n.toFixed(2)}%` : `${n.toFixed(1)}%`;
}

/** % difference of current vs baseline (positive = above baseline). */
export function pctVsBaseline(
  current: number,
  baseline: number,
  kind: IgMetricKind = "count",
  opts?: { historicalSamples?: number }
): IgGuardedBaselinePct {
  if (!Number.isFinite(current) || !Number.isFinite(baseline) || baseline <= 0) {
    return { pct: null };
  }
  return guardIgPctVsBaseline(current, baseline, kind, opts);
}

type IgInsightCandidate = IgWeeklyInsightTag & { priority: number };

/** Resolve conflicting tags — reach decline beats tier labels, engagement vs posting, etc. */
function pickWeeklyInsightTags(candidates: IgInsightCandidate[]): IgWeeklyInsightTag[] {
  if (!candidates.length) return [];

  const sorted = [...candidates].sort((a, b) => b.priority - a.priority);
  const picked: IgInsightCandidate[] = [];

  const reachDown = sorted.some(
    (t) => t.category === "reach_trend" && (t.id.includes("down") || t.id === "reach-strong-down")
  );
  const reachUpStrong = sorted.some((t) => t.id === "reach-strong-up" || t.id === "reach-mild-up");
  const highReachLowEng = sorted.some((t) => t.id === "high-reach-low-eng");
  const engSurging = sorted.some((t) => t.id === "eng-strong-up");

  for (const tag of sorted) {
    if (picked.length >= IG_WEEKLY_MAX_INSIGHT_TAGS) break;

    if (reachDown) {
      if (tag.category === "absolute_tier" && tag.id !== "best-week-month") continue;
      if (tag.id === "reach-strong-up" || tag.id === "reach-mild-up" || tag.id === "cadence-lift") {
        continue;
      }
    }
    if (reachUpStrong && tag.id === "reach-strong-down") continue;
    if (highReachLowEng && tag.id === "eng-strong-up") continue;
    if (engSurging && tag.id === "high-reach-low-eng") continue;
    if (tag.id === "tier-needs" && reachUpStrong) continue;
    if (tag.id === "tier-top" && reachDown) continue;

    if (picked.some((p) => p.id === tag.id)) continue;
    if (picked.some((p) => p.category === tag.category && p.category !== "absolute_tier")) {
      continue;
    }

    picked.push(tag);
  }

  return picked.map(({ priority: _p, ...tag }) => tag);
}

/** Extensible rule-based tags — up to 3 decision-relevant tags per model/week. */
export function generateIgWeeklyInsights(ctx: IgWeeklyInsightContext): IgWeeklyInsightTag[] {
  const candidates: IgInsightCandidate[] = [];
  const reachWow = ctx.reach_wow_pct;
  const catPri = (category: IgWeeklyInsightCategory, boost = 0) =>
    IG_INSIGHT_CATEGORY_PRIORITY[category] + boost;

  if (ctx.is_best_week_in_month && ctx.reach > 0) {
    candidates.push({
      id: "best-week-month",
      label: "Best Week This Month",
      severity: "positive",
      category: "absolute_tier",
      icon: "star",
      priority: catPri("absolute_tier", 30),
    });
  }

  if (reachWow != null) {
    if (reachWow > 20) {
      candidates.push({
        id: "reach-strong-up",
        label: "Strong Growth Week",
        severity: "positive",
        category: "reach_trend",
        icon: "trending-up",
        priority: catPri("reach_trend", 25),
      });
    } else if (reachWow < -20) {
      candidates.push({
        id: "reach-strong-down",
        label: "Needs Attention",
        severity: reachWow <= -40 ? "critical" : "warning",
        category: "reach_trend",
        icon: "trending-down",
        priority: catPri("reach_trend", reachWow <= -40 ? 35 : 28),
      });
    } else if (Math.abs(reachWow) <= 10) {
      candidates.push({
        id: "reach-steady",
        label: "Steady",
        severity: "neutral",
        category: "reach_trend",
        icon: "minus",
        priority: catPri("reach_trend", 5),
      });
    } else if (reachWow > 10) {
      candidates.push({
        id: "reach-mild-up",
        label: "Modest reach lift",
        severity: "positive",
        category: "reach_trend",
        icon: "trending-up",
        priority: catPri("reach_trend", 12),
      });
    } else {
      candidates.push({
        id: "reach-mild-down",
        label: "Soft reach dip",
        severity: "warning",
        category: "reach_trend",
        icon: "trending-down",
        priority: catPri("reach_trend", 15),
      });
    }
  }

  const peers = ctx.team_week_reach.filter((r) => r > 0);
  if (ctx.reach > 0 && peers.length >= 2) {
    const sorted = [...peers].sort((a, b) => b - a);
    const rank = sorted.findIndex((r) => r === ctx.reach) + 1 || sorted.length;
    const of = sorted.length;
    const percentile = of <= 1 ? 100 : Math.round(((of - rank) / (of - 1)) * 100);
    if (percentile >= 75 || rank === 1) {
      candidates.push({
        id: "tier-top",
        label: "Top Performer",
        severity: "positive",
        category: "absolute_tier",
        icon: "star",
        priority: catPri("absolute_tier", 10),
      });
    } else if (percentile <= 25) {
      candidates.push({
        id: "tier-needs",
        label: "Needs Improvement",
        severity: "warning",
        category: "absolute_tier",
        icon: "alert",
        priority: catPri("absolute_tier", 8),
      });
    }
  } else if (ctx.reach <= 0 && ctx.posts_in_week > 0) {
    candidates.push({
      id: "tier-needs-zero-reach",
      label: "Needs Improvement",
      severity: "warning",
      category: "absolute_tier",
      icon: "alert",
      priority: catPri("absolute_tier", 12),
    });
  }

  const er = ctx.avg_engagement_rate;
  const teamEr = ctx.team_median_engagement;
  const teamPost = ctx.team_median_posting;
  const highPost =
    ctx.posting_frequency != null &&
    teamPost != null &&
    ctx.posting_frequency >= teamPost * 1.2;
  const lowEr =
    er != null && teamEr != null && teamEr > 0 && er < teamEr * 0.6;
  const highEr =
    er != null && teamEr != null && teamEr > 0 && er >= teamEr * 1.25;
  const lowPost =
    teamPost != null &&
    ctx.posting_frequency != null &&
    ctx.posting_frequency > 0 &&
    ctx.posting_frequency < teamPost * 0.55;

  const reachRankHigh =
    peers.length >= 2 &&
    ctx.reach > 0 &&
    ctx.reach >= (sortedDesc(peers)[Math.floor(peers.length * 0.25)] ?? 0);
  if (reachRankHigh && lowEr) {
    candidates.push({
      id: "high-reach-low-eng",
      label: "High Reach, Low Engagement",
      severity: "warning",
      category: "engagement",
      icon: "message-circle",
      priority: catPri("engagement", 22),
    });
  }

  const erWow = ctx.engagement_wow_pct;
  if (erWow != null) {
    if (erWow > 20) {
      candidates.push({
        id: "eng-strong-up",
        label: "Engagement surging",
        severity: "positive",
        category: "engagement",
        icon: "trending-up",
        priority: catPri("engagement", 18),
      });
    } else if (erWow < -20) {
      candidates.push({
        id: "eng-strong-down",
        label: "Engagement cooling",
        severity: "warning",
        category: "engagement",
        icon: "trending-down",
        priority: catPri("engagement", 20),
      });
    }
  }

  if (ctx.is_consistent_poster) {
    candidates.push({
      id: "consistent-poster",
      label: "Consistent Poster",
      severity: "positive",
      category: "posting",
      icon: "target",
      priority: catPri("posting", 10),
    });
  }

  if (highPost && lowEr) {
    candidates.push({
      id: "post-high-er-low",
      label: "High posting, weak engagement",
      severity: "warning",
      category: "posting",
      icon: "message-circle",
      priority: catPri("posting", 15),
    });
  }
  if (highEr && lowPost) {
    candidates.push({
      id: "efficient-underposted",
      label: "Strong content — post more",
      severity: "info",
      category: "posting",
      priority: catPri("posting", 8),
    });
  }
  if (ctx.posting_reach_correlation != null && ctx.posting_reach_correlation >= 0.55) {
    candidates.push({
      id: "post-reach-correlated",
      label: "Posting drives reach",
      severity: "positive",
      category: "posting",
      icon: "target",
      priority: catPri("posting", 12),
    });
  } else if (ctx.posting_reach_correlation != null && ctx.posting_reach_correlation <= -0.4) {
    candidates.push({
      id: "post-reach-inverse",
      label: "Reach despite low posts",
      severity: "info",
      category: "posting",
      priority: catPri("posting", 6),
    });
  }

  const delta = ctx.follower_delta;
  const priorDelta = ctx.prior_follower_delta;
  if (delta != null && priorDelta != null) {
    const accel = delta - priorDelta;
    if (accel > 50) {
      candidates.push({
        id: "growth-accelerating",
        label: "Follower growth accelerating",
        severity: "positive",
        category: "growth",
        priority: catPri("growth", 12),
      });
    } else if (accel < -50) {
      candidates.push({
        id: "growth-decelerating",
        label: "Follower growth slowing",
        severity: "warning",
        category: "growth",
        priority: catPri("growth", 14),
      });
    }
  } else if (delta != null && delta > 100) {
    candidates.push({
      id: "growth-strong-week",
      label: "Strong follower week",
      severity: "positive",
      category: "growth",
      priority: catPri("growth", 10),
    });
  } else if (delta != null && delta < -20) {
    candidates.push({
      id: "growth-negative",
      label: "Follower loss this week",
      severity: "warning",
      category: "growth",
      priority: catPri("growth", 16),
    });
  }

  const postWow = ctx.posting_wow_pct;
  if (postWow != null && postWow > 30 && (reachWow ?? 0) > 10) {
    candidates.push({
      id: "cadence-lift",
      label: "Cadence boost paying off",
      severity: "positive",
      category: "posting",
      icon: "target",
      priority: catPri("posting", 14),
    });
  }

  return pickWeeklyInsightTags(candidates);
}

function sortedDesc(nums: number[]): number[] {
  return [...nums].sort((a, b) => b - a);
}

/**
 * 2–3 sentence natural-language synthesis for manager weekly model calls.
 * Built from rule-based signals — not LLM-generated.
 */
export function generateIgWeeklyTalkingPoints(ctx: IgWeeklyTalkingPointsContext): string {
  const parts: string[] = [];
  const name = ctx.modelName.trim() || "This model";

  // Lead sentence: headline performance
  if (ctx.is_best_week_in_month && ctx.reach > 0) {
    const wow =
      ctx.reach_wow_note === "new_activity"
        ? " (new activity vs prior week)"
        : ctx.reach_wow_pct != null
          ? ` (${fmtPctShort(ctx.reach_wow_pct, { pct_capped: ctx.reach_wow_capped })} WoW)`
          : "";
    parts.push(
      `${name}'s Week ${ctx.week} was their strongest this month at ${fmtCompact(ctx.reach)} reach${wow}.`
    );
  } else if (ctx.reach_wow_pct != null && ctx.reach_wow_pct > 20) {
    parts.push(
      `Reach jumped ${fmtPctShort(ctx.reach_wow_pct, {
        display_note: ctx.reach_wow_note,
        pct_capped: ctx.reach_wow_capped,
      })} week-over-week to ${fmtCompact(ctx.reach)} — a clear growth week for ${name}.`
    );
  } else if (ctx.reach_wow_note === "new_activity") {
    parts.push(
      `${name} had new Instagram reach activity this week (${fmtCompact(ctx.reach)} total) — prior week was too quiet for a fair comparison.`
    );
  } else if (ctx.reach_wow_pct != null && ctx.reach_wow_pct < -20) {
    parts.push(
      `Reach fell ${fmtPctShort(ctx.reach_wow_pct, {
        signed: false,
        display_note: ctx.reach_wow_note,
        pct_capped: ctx.reach_wow_capped,
      })} vs last week (${fmtCompact(ctx.reach)} total) — worth discussing content mix and timing with ${name}.`
    );
  } else if (ctx.reach > 0) {
    const wowSuffix =
      ctx.reach_wow_pct != null || ctx.reach_wow_note
        ? ` (${fmtPctShort(ctx.reach_wow_pct, {
            display_note: ctx.reach_wow_note,
            pct_capped: ctx.reach_wow_capped,
          })} vs prior week)`
        : "";
    parts.push(`Week ${ctx.week} landed at ${fmtCompact(ctx.reach)} reach${wowSuffix}.`);
  } else if (ctx.posts_in_week > 0) {
    parts.push(
      `${name} posted ${ctx.posts_in_week} time${ctx.posts_in_week === 1 ? "" : "s"} this week but reach hasn't registered yet — check sync or account health.`
    );
  } else {
    parts.push(`Week ${ctx.week} was quiet on Instagram for ${name} — no posts or reach recorded.`);
  }

  // Second sentence: engagement, posting, or follower angle
  const er = ctx.avg_engagement_rate;
  if (er != null && er > 0) {
    if (ctx.engagement_wow_note === "new_activity") {
      parts.push(
        `Engagement rate rose to ${fmtErPct(er)} (up from a near-zero prior week)${ctx.top_post_label ? `, led by a strong ${ctx.top_post_label}` : ""}.`
      );
    } else if (ctx.engagement_wow_pct != null && ctx.engagement_wow_pct > 15) {
      parts.push(
        `Engagement rate rose to ${fmtErPct(er)} (${fmtPctShort(ctx.engagement_wow_pct, {
          display_note: ctx.engagement_wow_note,
          pct_capped: ctx.engagement_wow_capped,
        })} WoW)${ctx.top_post_label ? `, led by a strong ${ctx.top_post_label}` : ""}.`
      );
    } else if (
      er != null &&
      ctx.vs_team_engagement_pct != null &&
      ctx.vs_team_engagement_pct < -25 &&
      !ctx.vs_team_engagement_note
    ) {
      parts.push(
        `Engagement at ${fmtErPct(er)} trails the team average — content may be reaching broadly without converting to interactions.`
      );
    } else if (ctx.posts_in_week >= 3 && ctx.posting_frequency != null) {
      parts.push(
        `Posted ${ctx.posts_in_week} times (~${ctx.posting_frequency.toFixed(1)}/wk pace) with ${fmtErPct(er)} engagement${ctx.top_post_label ? `; top performer was a ${ctx.top_post_label}` : ""}.`
      );
    } else {
      parts.push(`Engagement rate held at ${fmtErPct(er)} for the week.`);
    }
  } else if (ctx.follower_delta != null && ctx.follower_delta !== 0) {
    const sign = ctx.follower_delta >= 0 ? "+" : "";
    const pct =
      ctx.follower_growth_pct != null ? ` (${fmtPctShort(ctx.follower_growth_pct)})` : "";
    parts.push(
      `Followers ${ctx.follower_delta >= 0 ? "grew" : "declined"} by ${sign}${fmtCompact(ctx.follower_delta)}${pct}.`
    );
  }

  // Third sentence: historical / team context or cross-platform
  if (ctx.cross_platform_note) {
    parts.push(ctx.cross_platform_note);
  } else if (
    ctx.vs_historical_reach_pct != null &&
    ctx.historical_weeks_sampled >= 2 &&
    Math.abs(ctx.vs_historical_reach_pct) >= 12 &&
    !ctx.vs_historical_reach_note
  ) {
    const dir = ctx.vs_historical_reach_pct > 0 ? "above" : "below";
    parts.push(
      `That's ${fmtPctShort(Math.abs(ctx.vs_historical_reach_pct), {
        signed: false,
        pct_capped: ctx.vs_historical_reach_capped,
      })} ${dir} ${name}'s typical Week ${ctx.week} based on ${ctx.historical_weeks_sampled} prior months.`
    );
  } else if (
    ctx.vs_historical_reach_note === "insufficient_history" ||
    ctx.vs_historical_reach_note === "insufficient_baseline"
  ) {
    parts.push(`Not enough prior Instagram history to compare Week ${ctx.week} to a typical week yet.`);
  } else if (
    ctx.vs_team_reach_pct != null &&
    Math.abs(ctx.vs_team_reach_pct) >= 15 &&
    !ctx.vs_team_reach_note
  ) {
    const dir = ctx.vs_team_reach_pct > 0 ? "ahead of" : "behind";
    parts.push(
      `Reach is ${fmtPctShort(Math.abs(ctx.vs_team_reach_pct), {
        signed: false,
        pct_capped: ctx.vs_team_reach_capped,
      })} ${dir} the team average this week.`
    );
  }

  return parts.slice(0, 3).join(" ");
}

/** Median helper for weekly progress aggregation. */
export function medianIgMetric(nums: number[]): number | null {
  return median(nums);
}

export function wowPctFromChange(change: PeriodChangeMetric): number | null {
  return change.pct_change;
}
