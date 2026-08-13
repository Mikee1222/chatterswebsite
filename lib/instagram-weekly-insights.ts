/**
 * Rule-based insight tags for Instagram Weekly Progress (custom 4-week months).
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
};

function median(nums: number[]): number | null {
  const valid = nums.filter((x) => Number.isFinite(x));
  if (valid.length === 0) return null;
  const s = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Extensible rule-based tags — multiple tags per model/week. */
export function generateIgWeeklyInsights(ctx: IgWeeklyInsightContext): IgWeeklyInsightTag[] {
  const tags: IgWeeklyInsightTag[] = [];
  const reachWow = ctx.reach_wow_pct;

  // Reach trend vs prior custom week
  if (reachWow != null) {
    if (reachWow > 20) {
      tags.push({
        id: "reach-strong-up",
        label: "📈 Strong Weekly Growth",
        severity: "positive",
        category: "reach_trend",
      });
    } else if (reachWow < -20) {
      tags.push({
        id: "reach-strong-down",
        label: "📉 Declining — needs attention",
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

/** Median helper for weekly progress aggregation. */
export function medianIgMetric(nums: number[]): number | null {
  return median(nums);
}

export function wowPctFromChange(change: PeriodChangeMetric): number | null {
  return change.pct_change;
}
