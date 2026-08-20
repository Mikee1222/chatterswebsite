/**
 * Derived creator-earnings analytics on synced Supabase Infloww tables.
 * Pure compute where possible — no fabricated insights when data is sparse.
 */

import { ymdInAthens } from "@/lib/airtable-datetime";
import { computePctChange, type PerformanceAlert, type PeriodChangeMetric } from "@/services/infloww-analytics";
import type {
  CreatorDailyStatsRow,
  CreatorRefundRow,
  CreatorTransactionRow,
  MarketingLinkRow,
  PriorityMassMessageRow,
} from "@/services/infloww-creator-earnings";
import { isCreatorTxRevenueCountable, creatorTxRevenueAmount } from "@/services/infloww-creator-earnings";

/** Refund rate above this fraction surfaces a warning alert. */
export const REFUND_RATE_WARN = 0.05;
/** Refund rate above this fraction surfaces a critical alert. */
export const REFUND_RATE_CRITICAL = 0.1;
/** Auto-renew share below this (of active fans) is flagged at-risk. */
export const CHURN_RISK_RENEW_ON_FLOOR = 0.25;
/** Need this many PMM rows with price+purchases before pricing insight. */
const PMM_PRICING_MIN_SAMPLES = 5;
/** Need this many models with tenure + growth before tenure insight. */
const TENURE_INSIGHT_MIN_MODELS = 4;

export type NetProfitBreakdown = {
  gross: number;
  fees: number;
  refunds: number;
  /** gross − fees − refunds */
  net_profit: number;
  transaction_count: number;
  refund_count: number;
};

export type RefundRateStats = {
  gross: number;
  refunds: number;
  rate: number | null;
  flagged: "ok" | "warn" | "critical" | "na";
};

export type ChurnRiskStats = {
  active_fans: number;
  /** Null when renew-on was not reported for this snapshot day. */
  fans_with_renew_on: number | null;
  /** renew-on ÷ active (0–1). Higher = healthier retention signal. */
  renew_on_share: number | null;
  at_risk: boolean;
  /** Constructive label for model UI. */
  label: string;
};

export type AcquisitionEfficiency = {
  link_id: string;
  model_id: string;
  link_type: string;
  message: string | null;
  sub_count: number;
  paying_fans_count: number;
  earnings_gross: number;
  earnings_net: number;
  /** Revenue per acquired subscriber (gross ÷ sub_count). */
  revenue_per_sub: number | null;
  /** True CPA unavailable — Infloww links have no cost field. */
  true_cpa_available: false;
};

export type MassMessageLeaderboardRow = {
  employee_id: string;
  times_sent: number;
  purchases: number;
  revenue: number;
  conversion_rate: number | null;
  message_count: number;
};

export type TenureGrowthPoint = {
  model_record_id: string;
  model_name: string;
  /** Days since modelss.created_at when available. */
  tenure_days: number | null;
  revenue: number;
  new_subscribers: number;
  fan_growth: number;
};

export type TenureGrowthInsight = {
  available: boolean;
  note: string;
  sample_size: number;
  /** Pearson correlation tenure_days vs revenue when both exist. */
  correlation: number | null;
};

export type OptimalPricingInsight = {
  available: boolean;
  note: string;
  sample_size: number;
  /** Best-converting price band when pattern exists. */
  best_band: { min: number; max: number; conversion_rate: number; n: number } | null;
};

export type CreatorModelAnalytics = {
  model_record_id: string | null;
  creator_infloww_id: string;
  model_name: string;
  profit: NetProfitBreakdown;
  refund_rate: RefundRateStats;
  churn: ChurnRiskStats;
  arpu: number | null;
  revenue_mix: {
    by_type: Array<{ type: string; gross: number; share: number }>;
  };
  growth: {
    new_subscribers: number;
    renewals: number;
    profile_visitors: number;
    messages_sent: number;
    latest_rank: number | null;
  };
  revenue_change: PeriodChangeMetric | null;
};

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const x = xs.slice(0, n);
  const y = ys.slice(0, n);
  const mx = sum(x) / n;
  const my = sum(y) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i]! - mx;
    const b = y[i]! - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  if (den < 1e-9) return null;
  return num / den;
}

export function computeNetProfit(params: {
  transactions: Array<Pick<CreatorTransactionRow, "amount" | "fee" | "net">>;
  refunds: Array<Pick<CreatorRefundRow, "payment_amount">>;
}): NetProfitBreakdown {
  const gross = sum(params.transactions.map(creatorTxRevenueAmount));
  const fees = sum(params.transactions.map((t) => t.fee));
  const refunds = sum(params.refunds.map((r) => r.payment_amount));
  return {
    gross,
    fees,
    refunds,
    net_profit: gross - refunds,
    transaction_count: params.transactions.length,
    refund_count: params.refunds.length,
  };
}

export function computeRefundRate(profit: NetProfitBreakdown): RefundRateStats {
  if (profit.gross <= 0 && profit.refunds <= 0) {
    return { gross: 0, refunds: 0, rate: null, flagged: "na" };
  }
  if (profit.gross <= 0 && profit.refunds > 0) {
    return { gross: 0, refunds: profit.refunds, rate: 1, flagged: "critical" };
  }
  const rate = profit.refunds / profit.gross;
  const flagged =
    rate >= REFUND_RATE_CRITICAL ? "critical" : rate >= REFUND_RATE_WARN ? "warn" : "ok";
  return { gross: profit.gross, refunds: profit.refunds, rate, flagged };
}

export function computeChurnRisk(params: {
  active_fans: number;
  fans_with_renew_on: number | null;
}): ChurnRiskStats {
  const active = Math.max(0, params.active_fans);
  const renew = params.fans_with_renew_on;
  if (active <= 0 || renew == null) {
    return {
      active_fans: active,
      fans_with_renew_on: renew,
      renew_on_share: null,
      at_risk: false,
      label:
        renew == null
          ? "Auto-renew data not reported by Infloww for this model yet."
          : "Not enough fan data yet to estimate auto-renew health.",
    };
  }
  const renewSafe = Math.max(0, renew);
  const share = Math.min(1, renewSafe / active);
  const at_risk = share < CHURN_RISK_RENEW_ON_FLOOR;
  const pct = Math.round(share * 100);
  return {
    active_fans: active,
    fans_with_renew_on: renewSafe,
    renew_on_share: share,
    at_risk,
    label: at_risk
      ? `${pct}% of active fans have auto-renew on — room to improve retention.`
      : `${pct}% of your active fans have auto-renew on — solid retention signal.`,
  };
}

export function computeAcquisitionEfficiency(
  links: MarketingLinkRow[]
): AcquisitionEfficiency[] {
  return links.map((l) => ({
    link_id: l.id,
    model_id: l.model_id,
    link_type: l.link_type,
    message: l.message,
    sub_count: l.sub_count,
    paying_fans_count: l.paying_fans_count,
    earnings_gross: l.earnings_gross,
    earnings_net: l.earnings_net,
    revenue_per_sub: l.sub_count > 0 ? l.earnings_gross / l.sub_count : null,
    true_cpa_available: false as const,
  }));
}

export function buildMassMessageLeaderboard(
  rows: PriorityMassMessageRow[]
): MassMessageLeaderboardRow[] {
  const byEmp = new Map<
    string,
    { times: number; purchases: number; revenue: number; count: number }
  >();
  for (const r of rows) {
    const emp = (r.employee_id ?? "").trim() || "unknown";
    const cur = byEmp.get(emp) ?? { times: 0, purchases: 0, revenue: 0, count: 0 };
    cur.times += r.number_of_times_sent;
    cur.purchases += r.number_of_purchases;
    cur.revenue += r.revenue;
    cur.count += 1;
    byEmp.set(emp, cur);
  }
  return [...byEmp.entries()]
    .map(([employee_id, v]) => ({
      employee_id,
      times_sent: v.times,
      purchases: v.purchases,
      revenue: v.revenue,
      conversion_rate: v.times > 0 ? v.purchases / v.times : null,
      message_count: v.count,
    }))
    .sort((a, b) => b.revenue - a.revenue || (b.conversion_rate ?? 0) - (a.conversion_rate ?? 0));
}

export function analyzeOptimalMessagePricing(
  rows: PriorityMassMessageRow[]
): OptimalPricingInsight {
  const usable = rows.filter((r) => r.price > 0 && r.number_of_times_sent > 0);
  if (usable.length < PMM_PRICING_MIN_SAMPLES) {
    return {
      available: false,
      note:
        usable.length === 0
          ? "No priority mass message pricing data synced yet."
          : `Need at least ${PMM_PRICING_MIN_SAMPLES} priced mass messages to spot a pricing pattern (have ${usable.length}).`,
      sample_size: usable.length,
      best_band: null,
    };
  }

  // Bucket by $5 bands
  const bands = new Map<string, { min: number; max: number; sent: number; purchases: number; n: number }>();
  for (const r of usable) {
    const min = Math.floor(r.price / 5) * 5;
    const max = min + 5;
    const key = `${min}-${max}`;
    const cur = bands.get(key) ?? { min, max, sent: 0, purchases: 0, n: 0 };
    cur.sent += r.number_of_times_sent;
    cur.purchases += r.number_of_purchases;
    cur.n += 1;
    bands.set(key, cur);
  }
  const ranked = [...bands.values()]
    .filter((b) => b.n >= 2 && b.sent > 0)
    .map((b) => ({
      min: b.min,
      max: b.max,
      conversion_rate: b.purchases / b.sent,
      n: b.n,
    }))
    .sort((a, b) => b.conversion_rate - a.conversion_rate);

  if (ranked.length < 2) {
    return {
      available: false,
      note: "Not enough variety in message prices to compare conversion bands yet.",
      sample_size: usable.length,
      best_band: null,
    };
  }

  const best = ranked[0]!;
  const worst = ranked[ranked.length - 1]!;
  // Only claim a pattern if top band meaningfully beats bottom
  if (best.conversion_rate < worst.conversion_rate * 1.15 && best.conversion_rate - worst.conversion_rate < 0.02) {
    return {
      available: false,
      note: "Message prices show similar conversion rates across bands — no clear optimal range yet.",
      sample_size: usable.length,
      best_band: null,
    };
  }

  return {
    available: true,
    note: `Messages priced $${best.min}–$${best.max} convert best in the synced sample (${(best.conversion_rate * 100).toFixed(1)}% purchase rate, n=${best.n}).`,
    sample_size: usable.length,
    best_band: best,
  };
}

export function analyzeTenureVsGrowth(points: TenureGrowthPoint[]): TenureGrowthInsight {
  const usable = points.filter((p) => p.tenure_days != null && p.tenure_days >= 0);
  if (usable.length < TENURE_INSIGHT_MIN_MODELS) {
    return {
      available: false,
      note:
        usable.length === 0
          ? "Model tenure dates aren’t available to compare growth by age."
          : `Need at least ${TENURE_INSIGHT_MIN_MODELS} models with tenure data for a tenure/growth insight (have ${usable.length}).`,
      sample_size: usable.length,
      correlation: null,
    };
  }
  const tenure = usable.map((p) => p.tenure_days as number);
  const revenue = usable.map((p) => p.revenue);
  const corr = pearson(tenure, revenue);
  if (corr == null) {
    return {
      available: false,
      note: "Couldn’t compute a stable tenure vs revenue relationship from current data.",
      sample_size: usable.length,
      correlation: null,
    };
  }
  // Negative corr → newer models earning more in the window
  if (corr <= -0.35) {
    return {
      available: true,
      note: `Newer models are growing faster than longer-tenured ones in this range (tenure↔revenue corr ${corr.toFixed(2)}).`,
      sample_size: usable.length,
      correlation: corr,
    };
  }
  if (corr >= 0.35) {
    return {
      available: true,
      note: `Longer-tenured models are outperforming newer ones on revenue in this range (tenure↔revenue corr ${corr.toFixed(2)}).`,
      sample_size: usable.length,
      correlation: corr,
    };
  }
  return {
    available: false,
    note: "No clear tenure vs growth pattern in this period — revenue isn’t strongly tied to model age.",
    sample_size: usable.length,
    correlation: corr,
  };
}

export function buildCreatorEarningsAlerts(params: {
  models: CreatorModelAnalytics[];
}): PerformanceAlert[] {
  const alerts: PerformanceAlert[] = [];
  for (const m of params.models) {
    const name = m.model_name || "Unknown model";
    if (m.refund_rate.flagged === "critical") {
      alerts.push({
        id: `refund-critical-${m.creator_infloww_id}`,
        severity: "critical",
        title: `High refund rate — ${name}`,
        detail: `${((m.refund_rate.rate ?? 0) * 100).toFixed(1)}% of gross was refunded (≥${REFUND_RATE_CRITICAL * 100}% threshold).`,
      });
    } else if (m.refund_rate.flagged === "warn") {
      alerts.push({
        id: `refund-warn-${m.creator_infloww_id}`,
        severity: "warning",
        title: `Elevated refunds — ${name}`,
        detail: `${((m.refund_rate.rate ?? 0) * 100).toFixed(1)}% refund rate (above ${REFUND_RATE_WARN * 100}%).`,
      });
    }
    if (m.churn.at_risk && m.churn.renew_on_share != null) {
      alerts.push({
        id: `churn-${m.creator_infloww_id}`,
        severity: "warning",
        title: `Low auto-renew share — ${name}`,
        detail: `Only ${Math.round(m.churn.renew_on_share * 100)}% of active fans have renew-on (below ${Math.round(CHURN_RISK_RENEW_ON_FLOOR * 100)}%).`,
      });
    }
    if (
      m.revenue_change &&
      m.revenue_change.direction === "down" &&
      (m.revenue_change.pct_change ?? 0) <= -25 &&
      m.profit.gross >= 50
    ) {
      alerts.push({
        id: `rev-drop-${m.creator_infloww_id}`,
        severity: "warning",
        title: `Revenue drop — ${name}`,
        detail: `Gross down ${Math.abs(m.revenue_change.pct_change ?? 0).toFixed(0)}% vs prior period.`,
      });
    }
    if (
      m.growth.latest_rank != null &&
      m.growth.latest_rank >= 50 &&
      m.profit.gross > 0
    ) {
      // Higher rank % = worse on Infloww (e.g. 50 = bottom half)
      alerts.push({
        id: `rank-${m.creator_infloww_id}`,
        severity: "info",
        title: `Soft platform rank — ${name}`,
        detail: `Latest performance rank ~${m.growth.latest_rank.toFixed(1)}% (higher % = further from top).`,
      });
    }
  }
  return alerts.slice(0, 40);
}

function revenueByType(
  txs: CreatorTransactionRow[]
): Array<{ type: string; gross: number; share: number }> {
  const map = new Map<string, number>();
  for (const t of txs) {
    const type = (t.type ?? "unknown").trim() || "unknown";
    map.set(type, (map.get(type) ?? 0) + creatorTxRevenueAmount(t));
  }
  const total = sum([...map.values()]);
  return [...map.entries()]
    .map(([type, gross]) => ({
      type,
      gross,
      share: total > 0 ? gross / total : 0,
    }))
    .sort((a, b) => b.gross - a.gross);
}

function revenueTransactions(transactions: CreatorTransactionRow[]): CreatorTransactionRow[] {
  return transactions.filter((t) => isCreatorTxRevenueCountable(t.status));
}

/**
 * Infloww often writes a stub "today" creator-report row (active_fans=0, renew-on null)
 * before the day is complete. Point-in-time metrics must use the latest *complete*
 * snapshot, not the newest calendar date.
 */
export function pickLatestCreatorDailySnapshot<
  T extends { date: string; active_fans: number; fans_with_renew_on?: number | null },
>(daily: T[]): T | null {
  if (!daily.length) return null;
  const sorted = [...daily].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const withRenew = sorted.find((d) => d.fans_with_renew_on != null);
  if (withRenew) return withRenew;
  const withFans = sorted.find((d) => d.active_fans > 0);
  return withFans ?? sorted[0]!;
}

/** Daily creator-share revenue (done txs only), bucketed on the Athens calendar. */
export function buildCreatorDailyRevenueTrend(
  transactions: CreatorTransactionRow[]
): Array<{ date: string; gross: number }> {
  const byDay = new Map<string, number>();
  for (const t of revenueTransactions(transactions)) {
    const day = ymdInAthens(t.created_time);
    if (!day) continue;
    byDay.set(day, (byDay.get(day) ?? 0) + creatorTxRevenueAmount(t));
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, gross]) => ({ date, gross }));
}

export function deriveModelCreatorAnalytics(params: {
  creatorInflowwId: string;
  modelRecordId: string | null;
  modelName: string;
  daily: CreatorDailyStatsRow[];
  transactions: CreatorTransactionRow[];
  refunds: CreatorRefundRow[];
  previousGross?: number;
}): CreatorModelAnalytics {
  const txs = revenueTransactions(params.transactions);
  const profit = computeNetProfit({
    transactions: txs,
    refunds: params.refunds,
  });
  const refund_rate = computeRefundRate(profit);

  const latest = pickLatestCreatorDailySnapshot(params.daily);
  const churn = computeChurnRisk({
    active_fans: latest?.active_fans ?? 0,
    fans_with_renew_on: latest?.fans_with_renew_on ?? null,
  });

  const active = latest?.active_fans ?? 0;
  const arpu = active > 0 ? profit.gross / active : null;

  const revenue_change =
    params.previousGross != null
      ? computePctChange(profit.gross, params.previousGross)
      : null;

  return {
    model_record_id: params.modelRecordId,
    creator_infloww_id: params.creatorInflowwId,
    model_name: params.modelName,
    profit,
    refund_rate,
    churn,
    arpu,
    revenue_mix: { by_type: revenueByType(txs) },
    growth: {
      new_subscribers: sum(params.daily.map((d) => d.new_subscribers)),
      renewals: sum(params.daily.map((d) => d.renewals)),
      profile_visitors: sum(params.daily.map((d) => d.profile_visitors)),
      messages_sent: sum(params.daily.map((d) => d.messages_sent)),
      latest_rank: latest?.performance_rank ?? null,
    },
    revenue_change,
  };
}

export type AgencyCreatorAnalytics = {
  agency_profit: NetProfitBreakdown;
  agency_refund_rate: RefundRateStats;
  models: CreatorModelAnalytics[];
  alerts: PerformanceAlert[];
  acquisition: AcquisitionEfficiency[];
  mass_message_leaderboard: MassMessageLeaderboardRow[];
  tenure_insight: TenureGrowthInsight;
  pricing_insight: OptimalPricingInsight;
  /** Chatter × model attributed sales heatmap cells. */
  chatter_model_heatmap: Array<{
    employee_id: string;
    model_record_id: string | null;
    model_name: string;
    sales: number;
  }>;
};

export function buildAgencyCreatorAnalytics(params: {
  linked: Array<{
    creatorInflowwId: string;
    modelRecordId: string;
    modelName: string;
    createdAt?: string | null;
  }>;
  daily: CreatorDailyStatsRow[];
  transactions: CreatorTransactionRow[];
  refunds: CreatorRefundRow[];
  marketingLinks: MarketingLinkRow[];
  priorityMassMessages: PriorityMassMessageRow[];
  previousGrossByCreator?: Map<string, number>;
}): AgencyCreatorAnalytics {
  const models: CreatorModelAnalytics[] = [];
  const tenurePoints: TenureGrowthPoint[] = [];

  for (const link of params.linked) {
    const daily = params.daily.filter(
      (d) =>
        d.creator_infloww_id === link.creatorInflowwId ||
        d.model_record_id === link.modelRecordId
    );
    const txs = params.transactions.filter(
      (t) =>
        t.creator_infloww_id === link.creatorInflowwId ||
        t.model_record_id === link.modelRecordId
    );
    const refunds = params.refunds.filter(
      (r) =>
        r.creator_infloww_id === link.creatorInflowwId ||
        r.model_record_id === link.modelRecordId
    );
    const analytics = deriveModelCreatorAnalytics({
      creatorInflowwId: link.creatorInflowwId,
      modelRecordId: link.modelRecordId,
      modelName: link.modelName,
      daily,
      transactions: txs,
      refunds,
      previousGross: params.previousGrossByCreator?.get(link.creatorInflowwId),
    });
    models.push(analytics);

    const latest = pickLatestCreatorDailySnapshot(daily);
    const first = daily.length
      ? daily.reduce((a, b) => (a.date <= b.date ? a : b))
      : null;
    let tenure_days: number | null = null;
    if (link.createdAt) {
      const ms = Date.parse(link.createdAt);
      if (Number.isFinite(ms)) {
        tenure_days = Math.max(0, Math.floor((Date.now() - ms) / 86_400_000));
      }
    }
    tenurePoints.push({
      model_record_id: link.modelRecordId,
      model_name: link.modelName,
      tenure_days,
      revenue: analytics.profit.gross,
      new_subscribers: analytics.growth.new_subscribers,
      fan_growth:
        latest && first ? latest.active_fans - first.active_fans : 0,
    });
  }

  const agency_profit = computeNetProfit({
    transactions: revenueTransactions(params.transactions),
    refunds: params.refunds,
  });
  const agency_refund_rate = computeRefundRate(agency_profit);

  const heatmapMap = new Map<string, { employee_id: string; model_record_id: string | null; model_name: string; sales: number }>();
  const nameByRecord = new Map(params.linked.map((l) => [l.modelRecordId, l.modelName]));
  for (const t of revenueTransactions(params.transactions)) {
    const emp = (t.attribute_employee_id ?? "").trim();
    if (!emp) continue;
    const mid = t.model_record_id;
    const k = `${emp}|${mid ?? t.creator_infloww_id}`;
    const cur = heatmapMap.get(k) ?? {
      employee_id: emp,
      model_record_id: mid,
      model_name: mid ? nameByRecord.get(mid) ?? "Unknown" : "Unknown",
      sales: 0,
    };
    cur.sales += t.sales_amount ?? creatorTxRevenueAmount(t);
    heatmapMap.set(k, cur);
  }

  return {
    agency_profit,
    agency_refund_rate,
    models: models.sort((a, b) => b.profit.net_profit - a.profit.net_profit),
    alerts: buildCreatorEarningsAlerts({ models }),
    acquisition: computeAcquisitionEfficiency(params.marketingLinks).sort(
      (a, b) => (b.revenue_per_sub ?? 0) - (a.revenue_per_sub ?? 0)
    ),
    mass_message_leaderboard: buildMassMessageLeaderboard(params.priorityMassMessages),
    tenure_insight: analyzeTenureVsGrowth(tenurePoints),
    pricing_insight: analyzeOptimalMessagePricing(params.priorityMassMessages),
    chatter_model_heatmap: [...heatmapMap.values()]
      .filter((c) => c.sales > 0)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 100),
  };
}

/** Metric tooltip copy for creator earnings UIs. */
export const CREATOR_EARNINGS_STAT_INFO = {
  gross:
    "Sum of synced Infloww creator earnings after the OnlyFans platform fee — matches Infloww dashboard category totals.",
  fees: "OnlyFans platform fees from transaction rows (pre-fee gross minus creator net).",
  refunds: "Sum of refund payment amounts from GET /v1/refunds in the selected range.",
  net_profit: "Creator earnings minus refunds in the selected range.",
  refund_rate: "Refunds ÷ gross. Warns above 5%, critical above 10%.",
  visitors: "Profile visitors from Infloww creator-report reach.",
  active_fans: "Latest active fan count from creator-report in range.",
  expired_fans: "Latest expired fan count from creator-report in range.",
  renew_on: "Fans with auto-renew enabled (creator-report fans/renew-on).",
  churn_risk: "Auto-renew share of active fans. Below 25% is flagged as retention risk.",
  new_subs: "New subscribers summed across days in the selected range.",
  renewals: "Subscriber renewals summed across days in the selected range.",
  arpu: "Gross revenue ÷ latest active fans in range.",
  rank: "Platform performance rank from Infloww (lower % is better).",
  marketing: "Campaign / trial / tracking link earnings from Infloww links.",
  rev_per_sub:
    "Gross link earnings ÷ subscribers acquired. True CPA isn’t available — Infloww links have no cost field.",
  pmm_leaderboard: "Chatters ranked by priority mass message revenue and purchase conversion.",
  pmm_conversion: "Purchases ÷ times sent for priority mass messages.",
  heatmap: "Attributed sales from transaction-perf by chatter × model.",
  tenure: "Best-effort insight correlating model age (created_at) with revenue — only when a real pattern exists.",
  pricing: "Best-effort insight on which mass-message price bands convert best — only when data supports it.",
} as const;
