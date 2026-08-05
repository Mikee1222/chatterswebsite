/**
 * Derived analytics on synced `infloww_daily_stats` (+ optional shifts / team context).
 * Pure compute — no I/O. Used by admin + chatter performance UIs.
 */

import type { InflowwDailyStatsRow } from "@/services/infloww-daily-stats";

/** Subset of aggregated Infloww totals needed for derived metrics. */
export type AnalyticsTotalsInput = {
  sales: number;
  ppv_sales: number;
  tips: number;
  messages_sent: number;
  ppvs_sent: number;
  fans_chatted: number;
  fans_who_spent: number;
  /** Direct from chat-summary `ppvsUnlocked` (preferred unlock stage). */
  ppvs_unlocked: number;
  /**
   * True when any synced row in the period had chat-summary unlock fields
   * (`unlock_rate` not null). Distinguishes real 0% from pre-backfill zeros.
   */
  has_direct_unlock_metrics?: boolean;
};

export type PeriodChangeMetric = {
  current: number;
  previous: number;
  pct_change: number | null;
  direction: "up" | "down" | "flat" | "na";
};

export type ConversionFunnel = {
  messages: number;
  ppvs_sent: number;
  /** PPVs unlocked (direct) or fans_who_spent fallback. */
  unlocked: number;
  revenue: number;
  msg_to_ppv_rate: number | null;
  unlock_rate: number | null;
  /** True when neither direct unlock fields nor fans_who_spent are usable. */
  unlock_data_sparse: boolean;
  notes: string[];
};

export type PersonalBest = {
  best_day: { ymd: string; sales: number } | null;
  best_week: { week_start: string; week_end: string; sales: number } | null;
};

export type TeamStanding = {
  rank: number;
  of: number;
  /** 0–100, higher = better (top of team). */
  percentile: number;
  /** Warm constructive label for chatter UI. */
  label: string;
};

export type WhaleCandidateSuggestion = {
  id: string;
  /** Display name / username hint */
  label: string;
  reason: string;
  estimated_spend: number | null;
  /** Creator context when known */
  performer_name: string | null;
  performer_id: number | null;
  /** Prefill for Add Whale flow */
  suggested_username: string | null;
  source: "rebill_crossref" | "high_avg_spend_signal";
  /** Chatter public id when known (rebill cross-ref). */
  chatter_public_id: string | null;
  chatter_name: string | null;
};

export type RebillRetentionNote = {
  available: boolean;
  sample_size: number;
  /** Pearson-ish correlation of rebill count vs sales when both series exist. */
  correlation: number | null;
  note: string;
};

export type PerformanceAlert = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  user_public_id?: string;
  user_name?: string;
};

export type HighEffortLowConversion = {
  flagged: boolean;
  messages: number;
  sales: number;
  team_median_sales_per_msg: number | null;
  sales_per_message: number | null;
  detail: string | null;
};

export type CompensationRoi = {
  revenue: number;
  estimated_comp: number | null;
  ratio: number | null;
  compensation_type: string | null;
  compensation_value: number | null;
  note: string | null;
};

export type DerivedChatterAnalytics = {
  revenue_per_hour: number | null;
  shift_hours: number;
  avg_ppv_price: number | null;
  avg_tip_size: number | null;
  tip_size_note: string | null;
  revenue_per_fan: number | null;
  funnel: ConversionFunnel;
  consistency_score: number | null;
  personal_best: PersonalBest;
  period_change: {
    sales: PeriodChangeMetric;
    unlock_rate: PeriodChangeMetric;
    messages: PeriodChangeMetric;
  };
  team_standing: TeamStanding | null;
  whale_suggestions: WhaleCandidateSuggestion[];
  rebill_retention: RebillRetentionNote;
  high_effort_low_conversion: HighEffortLowConversion;
  roi: CompensationRoi | null;
  /** Creator ranking for this chatter (already sorted by sales desc). */
  top_creator_label: string | null;
};

export type ChatterCreatorHeatCell = {
  user_public_id: string;
  user_name: string;
  performer_id: number;
  performer_name: string;
  sales: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function rate(num: number, den: number): number | null {
  if (den <= 0) return null;
  return num / den;
}

function pctChange(current: number, previous: number): PeriodChangeMetric {
  if (previous === 0 && current === 0) {
    return { current, previous, pct_change: null, direction: "flat" };
  }
  if (previous === 0) {
    return { current, previous, pct_change: null, direction: current > 0 ? "up" : "na" };
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const direction: PeriodChangeMetric["direction"] =
    Math.abs(pct) < 0.5 ? "flat" : pct > 0 ? "up" : "down";
  return { current, previous, pct_change: round2(pct), direction };
}

function startOfWeekMonday(ymd: string): string {
  const parts = ymd.trim().slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some((x) => !Number.isFinite(x))) return ymd;
  const mid = new Date(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!, 12, 0, 0));
  const dow = mid.getUTCDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  mid.setUTCDate(mid.getUTCDate() + delta);
  return mid.toISOString().slice(0, 10);
}

function addDaysYmd(ymd: string, days: number): string {
  const parts = ymd.trim().slice(0, 10).split("-").map(Number);
  if (parts.length !== 3) return ymd;
  const d = new Date(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!, 12, 0, 0));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Aggregate daily sales (all performers) for a user. */
export function dailySalesSeries(rows: InflowwDailyStatsRow[]): Array<{ ymd: string; sales: number }> {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.date, (map.get(r.date) ?? 0) + r.sales);
  }
  return Array.from(map.entries())
    .map(([ymd, sales]) => ({ ymd, sales }))
    .sort((a, b) => a.ymd.localeCompare(b.ymd));
}

export function computePersonalBest(allTimeRows: InflowwDailyStatsRow[]): PersonalBest {
  const daily = dailySalesSeries(allTimeRows);
  let best_day: PersonalBest["best_day"] = null;
  for (const d of daily) {
    if (!best_day || d.sales > best_day.sales) best_day = { ymd: d.ymd, sales: d.sales };
  }

  const weeks = new Map<string, number>();
  for (const d of daily) {
    const mon = startOfWeekMonday(d.ymd);
    weeks.set(mon, (weeks.get(mon) ?? 0) + d.sales);
  }
  let best_week: PersonalBest["best_week"] = null;
  for (const [week_start, sales] of weeks) {
    if (!best_week || sales > best_week.sales) {
      best_week = {
        week_start,
        week_end: addDaysYmd(week_start, 6),
        sales,
      };
    }
  }
  return { best_day, best_week };
}

/**
 * Consistency 0–100 from daily sales coefficient of variation.
 * Low variance → high score. Needs ≥3 active days.
 */
export function computeConsistencyScore(dailySales: number[]): number | null {
  const active = dailySales.filter((s) => s > 0);
  if (active.length < 3) return null;
  const mean = active.reduce((a, b) => a + b, 0) / active.length;
  if (mean <= 0) return null;
  const variance =
    active.reduce((acc, v) => acc + (v - mean) ** 2, 0) / active.length;
  const cv = Math.sqrt(variance) / mean;
  // cv=0 → 100; cv≥1.5 → ~0
  const score = Math.max(0, Math.min(100, Math.round((1 - cv / 1.5) * 100)));
  return score;
}

/**
 * Prefer chat-summary `ppvsUnlocked` / derived unlock rate; fall back to
 * sparse `fans_who_spent` only when direct unlock metrics were never synced.
 */
export function resolveUnlockMetrics(totals: AnalyticsTotalsInput): {
  unlocked: number;
  unlock_rate: number | null;
  unlock_data_sparse: boolean;
  source: "ppvs_unlocked" | "fans_who_spent" | "none";
} {
  const hasDirect =
    Boolean(totals.has_direct_unlock_metrics) || totals.ppvs_unlocked > 0;
  if (hasDirect) {
    return {
      unlocked: totals.ppvs_unlocked,
      unlock_rate: rate(totals.ppvs_unlocked, totals.ppvs_sent),
      unlock_data_sparse: false,
      source: "ppvs_unlocked",
    };
  }
  if (totals.fans_who_spent > 0) {
    return {
      unlocked: totals.fans_who_spent,
      unlock_rate: rate(totals.fans_who_spent, totals.ppvs_sent),
      unlock_data_sparse: false,
      source: "fans_who_spent",
    };
  }
  const sparse = totals.ppvs_sent > 0;
  return {
    unlocked: 0,
    unlock_rate: sparse ? null : rate(0, totals.ppvs_sent),
    unlock_data_sparse: sparse,
    source: "none",
  };
}

export function buildConversionFunnel(totals: AnalyticsTotalsInput): ConversionFunnel {
  const notes: string[] = [];
  const resolved = resolveUnlockMetrics(totals);
  if (resolved.unlock_data_sparse) {
    notes.push(
      "Unlock stage unavailable — Infloww unlock fields not yet synced for this range."
    );
  }
  return {
    messages: totals.messages_sent,
    ppvs_sent: totals.ppvs_sent,
    unlocked: resolved.unlocked,
    revenue: totals.sales,
    msg_to_ppv_rate: rate(totals.ppvs_sent, totals.messages_sent),
    unlock_rate: resolved.unlock_rate,
    unlock_data_sparse: resolved.unlock_data_sparse,
    notes,
  };
}

export function computeAvgPpvPrice(totals: AnalyticsTotalsInput): number | null {
  if (totals.ppvs_sent <= 0) return null;
  return round2(totals.ppv_sales / totals.ppvs_sent);
}

/**
 * Tip count isn't in infloww_daily_stats. Best-effort: count day×performer
 * rows with tips > 0 as tip "sessions".
 */
export function computeAvgTipSize(
  rows: InflowwDailyStatsRow[],
  tipsTotal: number
): { avg: number | null; note: string | null } {
  if (tipsTotal <= 0) return { avg: null, note: null };
  const tipSessions = rows.filter((r) => r.tips > 0).length;
  if (tipSessions <= 0) {
    return {
      avg: null,
      note: "Tip count not provided by Infloww sync — average tip size unavailable.",
    };
  }
  return {
    avg: round2(tipsTotal / tipSessions),
    note: "Estimated from day×creator rows with tips (Infloww does not sync tip event counts).",
  };
}

/** Minimum chatters with real sales before team rank/percentile is meaningful. */
export const MIN_TEAM_STANDING_PEERS = 3;

export function teamStandingFromRanks(
  sales: number,
  allSales: number[]
): TeamStanding | null {
  // Only rank among chatters with real data; need ≥3 peers for a meaningful standing.
  const peers = allSales.filter((s) => Number.isFinite(s) && s > 0);
  if (peers.length < MIN_TEAM_STANDING_PEERS) return null;
  const sorted = [...peers].sort((a, b) => b - a);
  const rank = sorted.findIndex((s) => s === sales) + 1 || sorted.length;
  const of = sorted.length;
  const percentile = Math.round(((of - rank) / (of - 1)) * 100);
  let label: string;
  if (percentile >= 75) label = "You're among the top performers this period — keep the momentum.";
  else if (percentile >= 40)
    label = "Solidly mid-pack — a few strong days can move you up.";
  else label = "Room to grow vs the team — focus on conversion, not just volume.";
  return { rank, of, percentile, label };
}

export function estimateCompensation(params: {
  revenue: number;
  shiftHours: number;
  compensation_type: string | null | undefined;
  compensation_value: number | null | undefined;
}): CompensationRoi {
  const { revenue, shiftHours, compensation_type, compensation_value } = params;
  if (compensation_type == null || compensation_value == null || !Number.isFinite(compensation_value)) {
    return {
      revenue,
      estimated_comp: null,
      ratio: null,
      compensation_type: compensation_type ?? null,
      compensation_value: compensation_value ?? null,
      note: "Set compensation on the account to estimate ROI.",
    };
  }
  let estimated_comp: number | null = null;
  if (compensation_type === "Percentage") {
    estimated_comp = round2(revenue * (compensation_value / 100));
  } else if (compensation_type === "Flat Fee") {
    // Flat fee treated as hourly when hours available, else as period flat.
    estimated_comp =
      shiftHours > 0
        ? round2(shiftHours * compensation_value)
        : round2(compensation_value);
  }
  const ratio =
    estimated_comp != null && estimated_comp > 0 ? round2(revenue / estimated_comp) : null;
  return {
    revenue,
    estimated_comp,
    ratio,
    compensation_type,
    compensation_value,
    note: null,
  };
}

export function detectHighEffortLowConversion(params: {
  messages: number;
  sales: number;
  teamSalesPerMsg: number[];
}): HighEffortLowConversion {
  const { messages, sales, teamSalesPerMsg } = params;
  const sales_per_message = rate(sales, messages);
  const valid = teamSalesPerMsg.filter((x) => x != null && Number.isFinite(x) && x >= 0);
  let team_median: number | null = null;
  if (valid.length >= 2) {
    const s = [...valid].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    team_median = s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
  }
  const flagged =
    messages >= 200 &&
    sales_per_message != null &&
    team_median != null &&
    sales_per_message < team_median * 0.45;
  return {
    flagged,
    messages,
    sales,
    team_median_sales_per_msg: team_median,
    sales_per_message,
    detail: flagged
      ? `High message volume (${messages}) with conversion well below team median — coach on PPV timing and offers.`
      : null,
  };
}

export function buildChatterAlerts(params: {
  user_public_id: string;
  user_name: string;
  period_change: DerivedChatterAnalytics["period_change"];
  high_effort: HighEffortLowConversion;
  consistency_score: number | null;
}): PerformanceAlert[] {
  const alerts: PerformanceAlert[] = [];
  const { period_change: pc, high_effort, consistency_score, user_public_id, user_name } = params;

  if (pc.sales.direction === "down" && (pc.sales.pct_change ?? 0) <= -20) {
    alerts.push({
      id: `sales-drop-${user_public_id}`,
      severity: (pc.sales.pct_change ?? 0) <= -40 ? "critical" : "warning",
      title: "Sales drop vs prior period",
      detail: `${user_name}: sales ${pc.sales.pct_change?.toFixed(0)}% vs prior period.`,
      user_public_id,
      user_name,
    });
  }
  if (
    !pc.unlock_rate.current &&
    pc.unlock_rate.previous > 0 &&
    pc.unlock_rate.direction === "down"
  ) {
    /* sparse unlock data — skip noisy alerts */
  } else if (
    pc.unlock_rate.direction === "down" &&
    (pc.unlock_rate.pct_change ?? 0) <= -25 &&
    pc.unlock_rate.previous > 0
  ) {
    alerts.push({
      id: `unlock-drop-${user_public_id}`,
      severity: "warning",
      title: "Unlock rate decline",
      detail: `${user_name}: unlock rate ${pc.unlock_rate.pct_change?.toFixed(0)}% vs prior.`,
      user_public_id,
      user_name,
    });
  }
  if (high_effort.flagged && high_effort.detail) {
    alerts.push({
      id: `effort-${user_public_id}`,
      severity: "warning",
      title: "High effort, low conversion",
      detail: high_effort.detail,
      user_public_id,
      user_name,
    });
  }
  if (consistency_score != null && consistency_score < 35) {
    alerts.push({
      id: `consistency-${user_public_id}`,
      severity: "info",
      title: "Inconsistent daily sales",
      detail: `${user_name}: consistency score ${consistency_score}/100 — uneven day-to-day results.`,
      user_public_id,
      user_name,
    });
  }
  return alerts;
}

export function buildHeatmapCells(
  chatters: Array<{
    user_public_id: string;
    full_name: string;
    by_performer: Array<{
      performer_id: number;
      performer_name: string;
      totals: { sales: number };
    }>;
  }>
): ChatterCreatorHeatCell[] {
  const cells: ChatterCreatorHeatCell[] = [];
  for (const c of chatters) {
    for (const p of c.by_performer) {
      if (!p.performer_id && p.totals.sales <= 0) continue;
      cells.push({
        user_public_id: c.user_public_id,
        user_name: c.full_name,
        performer_id: p.performer_id,
        performer_name: p.performer_name || `Creator ${p.performer_id}`,
        sales: p.totals.sales,
      });
    }
  }
  return cells;
}

/**
 * Best-effort rebill ↔ sales correlation across chatters.
 * Needs ≥4 chatters with both rebills and sales > 0.
 */
export function computeRebillSalesCorrelation(
  pairs: Array<{ rebills: number; sales: number }>
): RebillRetentionNote {
  const usable = pairs.filter((p) => p.rebills > 0 || p.sales > 0);
  if (usable.length < 4) {
    return {
      available: false,
      sample_size: usable.length,
      correlation: null,
      note: "Not enough chatter samples with both rebills and Infloww sales to correlate retention cleanly.",
    };
  }
  const xs = usable.map((p) => p.rebills);
  const ys = usable.map((p) => p.sales);
  const n = xs.length;
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
  if (den === 0) {
    return {
      available: false,
      sample_size: n,
      correlation: null,
      note: "Rebill/sales variance too low to compute a meaningful correlation.",
    };
  }
  const correlation = round2(num / den);
  return {
    available: true,
    sample_size: n,
    correlation,
    note:
      Math.abs(correlation) < 0.25
        ? "Weak link between logged rebills and Infloww sales in this sample — treat cautiously."
        : correlation > 0
          ? "Chatters with more logged rebills tend to show higher Infloww sales in this sample."
          : "Unexpected inverse relationship in this sample — data may be incomplete.",
  };
}

export function deriveChatterAnalytics(input: {
  totals: AnalyticsTotalsInput;
  rows: InflowwDailyStatsRow[];
  previousTotals: AnalyticsTotalsInput | null;
  shiftHours: number;
  allTimeRows: InflowwDailyStatsRow[];
  teamSales: number[];
  teamSalesPerMsg: number[];
  whaleSuggestions?: WhaleCandidateSuggestion[];
  rebillRetention?: RebillRetentionNote;
  compensation?: {
    compensation_type: string | null;
    compensation_value: number | null;
  } | null;
  includeRoi?: boolean;
  topCreatorName?: string | null;
}): DerivedChatterAnalytics {
  const {
    totals,
    rows,
    previousTotals,
    shiftHours,
    allTimeRows,
    teamSales,
    teamSalesPerMsg,
    whaleSuggestions = [],
    rebillRetention,
    compensation,
    includeRoi,
    topCreatorName,
  } = input;

  const funnel = buildConversionFunnel(totals);
  const tip = computeAvgTipSize(rows, totals.tips);
  const daily = dailySalesSeries(rows);
  const consistency_score = computeConsistencyScore(daily.map((d) => d.sales));
  const personal_best = computePersonalBest(allTimeRows.length ? allTimeRows : rows);

  const prev = previousTotals;
  const prevUnlock = prev ? resolveUnlockMetrics(prev).unlock_rate : null;
  const curUnlock = resolveUnlockMetrics(totals).unlock_rate;

  const period_change = {
    sales: pctChange(totals.sales, prev?.sales ?? 0),
    messages: pctChange(totals.messages_sent, prev?.messages_sent ?? 0),
    unlock_rate: pctChange(curUnlock ?? 0, prevUnlock ?? 0),
  };

  const high_effort_low_conversion = detectHighEffortLowConversion({
    messages: totals.messages_sent,
    sales: totals.sales,
    teamSalesPerMsg,
  });

  // Near-zero hours inflate $/h into absurd values — require ≥1h shifted.
  const revenue_per_hour =
    shiftHours >= 1 ? round2(totals.sales / shiftHours) : null;

  return {
    revenue_per_hour,
    shift_hours: round2(shiftHours),
    avg_ppv_price: computeAvgPpvPrice(totals),
    avg_tip_size: tip.avg,
    tip_size_note: tip.note,
    revenue_per_fan: rate(totals.sales, totals.fans_chatted),
    funnel,
    consistency_score,
    personal_best,
    period_change,
    team_standing: teamStandingFromRanks(totals.sales, teamSales),
    whale_suggestions: whaleSuggestions,
    rebill_retention:
      rebillRetention ??
      ({
        available: false,
        sample_size: 0,
        correlation: null,
        note: "Rebill retention correlation not computed for this view.",
      } satisfies RebillRetentionNote),
    high_effort_low_conversion,
    roi: includeRoi
      ? estimateCompensation({
          revenue: totals.sales,
          shiftHours,
          compensation_type: compensation?.compensation_type,
          compensation_value: compensation?.compensation_value,
        })
      : null,
    top_creator_label: topCreatorName ?? null,
  };
}

/** Previous period of equal length ending the day before `startYmd`. */
export function previousPeriodRange(
  startYmd: string,
  endYmd: string
): { startYmd: string; endYmd: string } {
  const partsS = startYmd.split("-").map(Number);
  const partsE = endYmd.split("-").map(Number);
  const s = new Date(Date.UTC(partsS[0]!, partsS[1]! - 1, partsS[2]!, 12));
  const e = new Date(Date.UTC(partsE[0]!, partsE[1]! - 1, partsE[2]!, 12));
  const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1);
  const prevEnd = addDaysYmd(startYmd, -1);
  const prevStart = addDaysYmd(prevEnd, -(days - 1));
  return { startYmd: prevStart, endYmd: prevEnd };
}

// ─── Weekly Progress insight rules (custom 4-week months) ───────────────────

export type WeeklyInsightSeverity = "positive" | "neutral" | "warning" | "critical" | "info";

export type WeeklyInsightCategory =
  | "sales_trend"
  | "absolute_tier"
  | "conversion"
  | "effort"
  | "volume";

export type WeeklyInsightTag = {
  id: string;
  label: string;
  severity: WeeklyInsightSeverity;
  category: WeeklyInsightCategory;
};

export type WeeklyInsightContext = {
  sales: number;
  ppv_sales: number;
  tips: number;
  messages_sent: number;
  fans_chatted: number;
  fan_cvr: number | null;
  /** WoW % change (null when no prior week). */
  sales_wow_pct: number | null;
  messages_wow_pct: number | null;
  cvr_wow_pct: number | null;
  /** Team sales for this week (peers with sales > 0). */
  team_week_sales: number[];
  /** Team median messages (for volume baselines). */
  team_median_messages: number | null;
  /** Team median fan_cvr among peers with fans_chatted > 0. */
  team_median_cvr: number | null;
};

function median(nums: number[]): number | null {
  const valid = nums.filter((x) => Number.isFinite(x));
  if (valid.length === 0) return null;
  const s = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Extensible rule-based tags — multiple tags per chatter/week. */
export function generateWeeklyInsights(ctx: WeeklyInsightContext): WeeklyInsightTag[] {
  const tags: WeeklyInsightTag[] = [];
  const salesWow = ctx.sales_wow_pct;
  const msgWow = ctx.messages_wow_pct;
  const cvrWow = ctx.cvr_wow_pct;

  // Sales trend vs prior custom week
  if (salesWow != null) {
    if (salesWow > 20) {
      tags.push({
        id: "sales-strong-up",
        label: "Strong Weekly Improvement",
        severity: "positive",
        category: "sales_trend",
      });
    } else if (salesWow < -20) {
      tags.push({
        id: "sales-strong-down",
        label: "Declining — needs attention",
        severity: salesWow <= -40 ? "critical" : "warning",
        category: "sales_trend",
      });
    } else if (Math.abs(salesWow) <= 10) {
      tags.push({
        id: "sales-steady",
        label: "Steady",
        severity: "neutral",
        category: "sales_trend",
      });
    } else if (salesWow > 10) {
      tags.push({
        id: "sales-mild-up",
        label: "Modest sales lift",
        severity: "positive",
        category: "sales_trend",
      });
    } else {
      tags.push({
        id: "sales-mild-down",
        label: "Soft sales dip",
        severity: "warning",
        category: "sales_trend",
      });
    }
  }

  // Absolute tier vs team that week
  const peers = ctx.team_week_sales.filter((s) => s > 0);
  if (ctx.sales > 0 && peers.length >= 2) {
    const sorted = [...peers].sort((a, b) => b - a);
    const rank = sorted.findIndex((s) => s === ctx.sales) + 1 || sorted.length;
    const of = sorted.length;
    const percentile = of <= 1 ? 100 : Math.round(((of - rank) / (of - 1)) * 100);
    if (percentile >= 75 || rank === 1) {
      tags.push({
        id: "tier-top",
        label: "Top Seller",
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
  } else if (ctx.sales <= 0 && (ctx.messages_sent > 0 || ctx.fans_chatted > 0)) {
    tags.push({
      id: "tier-needs-zero",
      label: "Needs Improvement",
      severity: "warning",
      category: "absolute_tier",
    });
  }

  // Effort / conversion patterns
  const cvr = ctx.fan_cvr;
  const teamCvr = ctx.team_median_cvr;
  const teamMsg = ctx.team_median_messages;
  const highMsgs =
    ctx.messages_sent >= 150 &&
    teamMsg != null &&
    ctx.messages_sent >= teamMsg * 1.15;
  const lowCvr =
    cvr != null &&
    teamCvr != null &&
    teamCvr > 0 &&
    cvr < teamCvr * 0.55;
  const highCvr =
    cvr != null &&
    teamCvr != null &&
    teamCvr > 0 &&
    cvr >= teamCvr * 1.25;
  const lowVolume =
    teamMsg != null &&
    ctx.messages_sent > 0 &&
    ctx.messages_sent < teamMsg * 0.55;

  if (highMsgs && lowCvr) {
    tags.push({
      id: "effort-high-cvr-low",
      label: "High effort, needs conversion coaching",
      severity: "warning",
      category: "effort",
    });
  }
  if (highCvr && lowVolume) {
    tags.push({
      id: "efficient-underutilized",
      label: "Efficient but underutilized",
      severity: "info",
      category: "effort",
    });
  }

  // Conversion trend
  if (cvrWow != null) {
    if (cvrWow > 20) {
      tags.push({
        id: "cvr-up",
        label: "Conversion climbing",
        severity: "positive",
        category: "conversion",
      });
    } else if (cvrWow < -20) {
      tags.push({
        id: "cvr-down",
        label: "Conversion slipping",
        severity: "warning",
        category: "conversion",
      });
    }
  }

  // Volume / effort trend
  if (msgWow != null) {
    if (msgWow > 25 && (salesWow == null || salesWow < 5)) {
      tags.push({
        id: "volume-up-sales-flat",
        label: "Volume up, sales lagging",
        severity: "warning",
        category: "volume",
      });
    } else if (msgWow < -25 && (salesWow == null || salesWow > -10)) {
      tags.push({
        id: "volume-down",
        label: "Lower outreach this week",
        severity: "info",
        category: "volume",
      });
    } else if (msgWow > 20 && salesWow != null && salesWow > 15) {
      tags.push({
        id: "volume-and-sales-up",
        label: "Effort and sales aligned",
        severity: "positive",
        category: "volume",
      });
    }
  }

  // Tips share signal
  if (ctx.sales > 50 && ctx.tips / ctx.sales >= 0.35) {
    tags.push({
      id: "tips-heavy",
      label: "Tips-heavy week",
      severity: "info",
      category: "sales_trend",
    });
  }
  if (ctx.sales > 50 && ctx.ppv_sales / ctx.sales >= 0.7) {
    tags.push({
      id: "ppv-driven",
      label: "PPV-driven week",
      severity: "info",
      category: "sales_trend",
    });
  }

  return tags;
}

/** Median helper exported for weekly progress aggregation. */
export function medianNumber(nums: number[]): number | null {
  return median(nums);
}

/** Public pct-change for weekly WoW metrics. */
export function computePctChange(current: number, previous: number): PeriodChangeMetric {
  return pctChange(current, previous);
}
