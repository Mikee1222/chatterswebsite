/**
 * Rule-based insight tags + Talking Points for Instagram Weekly Progress (custom 4-week months).
 */

import type { PeriodChangeMetric } from "@/services/infloww-analytics";

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
  avg_engagement_rate: number | null;
  engagement_wow_pct: number | null;
  follower_delta: number | null;
  follower_growth_pct: number | null;
  posts_in_week: number;
  posting_frequency: number | null;
  /** % above/below model's historical avg for this week index (null if no history). */
  vs_historical_reach_pct: number | null;
  vs_historical_engagement_pct: number | null;
  /** % above/below team average reach that week. */
  vs_team_reach_pct: number | null;
  vs_team_engagement_pct: number | null;
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

function fmtPctShort(n: number | null | undefined, opts?: { signed?: boolean }): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (opts?.signed === false) return `${Math.abs(n).toFixed(1)}%`;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function fmtErPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n < 1 ? `${n.toFixed(2)}%` : `${n.toFixed(1)}%`;
}

/** % difference of current vs baseline (positive = above baseline). */
export function pctVsBaseline(current: number, baseline: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(baseline) || baseline <= 0) return null;
  return ((current - baseline) / baseline) * 100;
}

/** Extensible rule-based tags — multiple tags per model/week. */
export function generateIgWeeklyInsights(ctx: IgWeeklyInsightContext): IgWeeklyInsightTag[] {
  const tags: IgWeeklyInsightTag[] = [];
  const reachWow = ctx.reach_wow_pct;

  if (ctx.is_best_week_in_month && ctx.reach > 0) {
    tags.push({
      id: "best-week-month",
      label: "🌟 Best Week This Month",
      severity: "positive",
      category: "absolute_tier",
    });
  }

  // Reach trend vs prior custom week
  if (reachWow != null) {
    if (reachWow > 20) {
      tags.push({
        id: "reach-strong-up",
        label: "📈 Strong Growth Week",
        severity: "positive",
        category: "reach_trend",
      });
    } else if (reachWow < -20) {
      tags.push({
        id: "reach-strong-down",
        label: "📉 Needs Attention",
        severity: reachWow <= -40 ? "critical" : "warning",
        category: "reach_trend",
      });
    } else if (Math.abs(reachWow) <= 10) {
      tags.push({
        id: "reach-steady",
        label: "➡️ Steady",
        severity: "neutral",
        category: "reach_trend",
      });
    } else if (reachWow > 10) {
      tags.push({
        id: "reach-mild-up",
        label: "Modest reach lift",
        severity: "positive",
        category: "reach_trend",
      });
    } else {
      tags.push({
        id: "reach-mild-down",
        label: "Soft reach dip",
        severity: "warning",
        category: "reach_trend",
      });
    }
  }

  // Absolute tier vs team that week
  const peers = ctx.team_week_reach.filter((r) => r > 0);
  if (ctx.reach > 0 && peers.length >= 2) {
    const sorted = [...peers].sort((a, b) => b - a);
    const rank = sorted.findIndex((r) => r === ctx.reach) + 1 || sorted.length;
    const of = sorted.length;
    const percentile = of <= 1 ? 100 : Math.round(((of - rank) / (of - 1)) * 100);
    if (percentile >= 75 || rank === 1) {
      tags.push({
        id: "tier-top",
        label: "🌟 Top Performer",
        severity: "positive",
        category: "absolute_tier",
      });
    } else if (percentile <= 25) {
      tags.push({
        id: "tier-needs",
        label: "Needs Improvement",
        severity: "warning",
        category: "absolute_tier",
      });
    } else {
      tags.push({
        id: "tier-avg",
        label: "Average",
        severity: "neutral",
        category: "absolute_tier",
      });
    }
  } else if (ctx.reach <= 0 && ctx.posts_in_week > 0) {
    tags.push({
      id: "tier-needs-zero-reach",
      label: "Needs Improvement",
      severity: "warning",
      category: "absolute_tier",
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
    tags.push({
      id: "high-reach-low-eng",
      label: "💬 High Reach, Low Engagement",
      severity: "warning",
      category: "engagement",
    });
  }

  // Engagement trend
  const erWow = ctx.engagement_wow_pct;
  if (erWow != null) {
    if (erWow > 20) {
      tags.push({
        id: "eng-strong-up",
        label: "Engagement surging",
        severity: "positive",
        category: "engagement",
      });
    } else if (erWow < -20) {
      tags.push({
        id: "eng-strong-down",
        label: "Engagement cooling",
        severity: "warning",
        category: "engagement",
      });
    }
  }

  if (ctx.is_consistent_poster) {
    tags.push({
      id: "consistent-poster",
      label: "🎯 Consistent Poster",
      severity: "positive",
      category: "posting",
    });
  }

  // Posting + engagement correlation insights
  if (highPost && lowEr) {
    tags.push({
      id: "post-high-er-low",
      label: "High posting, weak engagement",
      severity: "warning",
      category: "posting",
    });
  }
  if (highEr && lowPost) {
    tags.push({
      id: "efficient-underposted",
      label: "Strong content — post more",
      severity: "info",
      category: "posting",
    });
  }
  if (ctx.posting_reach_correlation != null && ctx.posting_reach_correlation >= 0.55) {
    tags.push({
      id: "post-reach-correlated",
      label: "Posting drives reach",
      severity: "positive",
      category: "posting",
    });
  } else if (ctx.posting_reach_correlation != null && ctx.posting_reach_correlation <= -0.4) {
    tags.push({
      id: "post-reach-inverse",
      label: "Reach despite low posts",
      severity: "info",
      category: "posting",
    });
  }

  // Follower growth acceleration/deceleration
  const delta = ctx.follower_delta;
  const priorDelta = ctx.prior_follower_delta;
  if (delta != null && priorDelta != null) {
    const accel = delta - priorDelta;
    if (accel > 50) {
      tags.push({
        id: "growth-accelerating",
        label: "Follower growth accelerating",
        severity: "positive",
        category: "growth",
      });
    } else if (accel < -50) {
      tags.push({
        id: "growth-decelerating",
        label: "Follower growth slowing",
        severity: "warning",
        category: "growth",
      });
    }
  } else if (delta != null && delta > 100) {
    tags.push({
      id: "growth-strong-week",
      label: "Strong follower week",
      severity: "positive",
      category: "growth",
    });
  } else if (delta != null && delta < -20) {
    tags.push({
      id: "growth-negative",
      label: "Follower loss this week",
      severity: "warning",
      category: "growth",
    });
  }

  const postWow = ctx.posting_wow_pct;
  if (postWow != null && postWow > 30 && (reachWow ?? 0) > 10) {
    tags.push({
      id: "cadence-lift",
      label: "Cadence boost paying off",
      severity: "positive",
      category: "posting",
    });
  }

  return tags;
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
      ctx.reach_wow_pct != null ? ` (${fmtPctShort(ctx.reach_wow_pct)} WoW)` : "";
    parts.push(
      `${name}'s Week ${ctx.week} was their strongest this month at ${fmtCompact(ctx.reach)} reach${wow}.`
    );
  } else if (ctx.reach_wow_pct != null && ctx.reach_wow_pct > 20) {
    parts.push(
      `Reach jumped ${fmtPctShort(ctx.reach_wow_pct)} week-over-week to ${fmtCompact(ctx.reach)} — a clear growth week for ${name}.`
    );
  } else if (ctx.reach_wow_pct != null && ctx.reach_wow_pct < -20) {
    parts.push(
      `Reach fell ${fmtPctShort(ctx.reach_wow_pct, { signed: false })} vs last week (${fmtCompact(ctx.reach)} total) — worth discussing content mix and timing with ${name}.`
    );
  } else if (ctx.reach > 0) {
    parts.push(
      `Week ${ctx.week} landed at ${fmtCompact(ctx.reach)} reach${ctx.reach_wow_pct != null ? ` (${fmtPctShort(ctx.reach_wow_pct)} vs prior week)` : ""}.`
    );
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
    if (ctx.engagement_wow_pct != null && ctx.engagement_wow_pct > 15) {
      parts.push(
        `Engagement rate rose to ${fmtErPct(er)} (${fmtPctShort(ctx.engagement_wow_pct)} WoW)${ctx.top_post_label ? `, led by a strong ${ctx.top_post_label}` : ""}.`
      );
    } else if (er != null && ctx.vs_team_engagement_pct != null && ctx.vs_team_engagement_pct < -25) {
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
    Math.abs(ctx.vs_historical_reach_pct) >= 12
  ) {
    const dir = ctx.vs_historical_reach_pct > 0 ? "above" : "below";
    parts.push(
      `That's ${fmtPctShort(Math.abs(ctx.vs_historical_reach_pct))} ${dir} ${name}'s typical Week ${ctx.week} based on ${ctx.historical_weeks_sampled} prior months.`
    );
  } else if (ctx.vs_team_reach_pct != null && Math.abs(ctx.vs_team_reach_pct) >= 15) {
    const dir = ctx.vs_team_reach_pct > 0 ? "ahead of" : "behind";
    parts.push(
      `Reach is ${fmtPctShort(Math.abs(ctx.vs_team_reach_pct))} ${dir} the team average this week.`
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
