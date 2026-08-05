/**
 * Infloww-backed challenge progress from `infloww_daily_stats`.
 */

import type { InflowwChallengeMetric } from "@/lib/challenges";
import {
  getUserInflowwLinkByPublicId,
  queryInflowwDailyStats,
  type InflowwDailyStatsRow,
} from "@/services/infloww-daily-stats";

export type InflowwProgressRange = {
  startYmd: string;
  endYmd: string;
};

export type InflowwChallengeProgressResult = {
  value: number;
  unavailable?: boolean;
  unavailable_reason?: string;
};

type Totals = {
  sales: number;
  ppv_sales: number;
  tips: number;
  messages_sent: number;
  ppvs_sent: number;
  ppvs_unlocked: number;
  fans_chatted: number;
  fans_who_spent: number;
  sales_per_hour_sum: number;
  sales_per_hour_weight: number;
  has_direct_unlock: boolean;
  unlock_rate_rows: number;
  golden_ratio_rows: number;
};

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function aggregateRows(rows: InflowwDailyStatsRow[]): Totals {
  const t: Totals = {
    sales: 0,
    ppv_sales: 0,
    tips: 0,
    messages_sent: 0,
    ppvs_sent: 0,
    ppvs_unlocked: 0,
    fans_chatted: 0,
    fans_who_spent: 0,
    sales_per_hour_sum: 0,
    sales_per_hour_weight: 0,
    has_direct_unlock: false,
    unlock_rate_rows: 0,
    golden_ratio_rows: 0,
  };

  for (const r of rows) {
    t.sales += r.sales;
    t.ppv_sales += r.ppv_sales;
    t.tips += r.tips;
    t.messages_sent += r.messages_sent;
    t.ppvs_sent += r.ppvs_sent;
    t.ppvs_unlocked += r.ppvs_unlocked;
    t.fans_chatted += r.fans_chatted;
    t.fans_who_spent += r.fans_who_spent;

    if (r.ppvs_unlocked > 0 || r.unlock_rate != null) {
      t.has_direct_unlock = true;
    }
    if (r.unlock_rate != null) t.unlock_rate_rows += 1;
    if (r.golden_ratio != null) t.golden_ratio_rows += 1;

    if (r.sales_per_hour != null && r.sales_per_hour > 0 && r.sales > 0) {
      t.sales_per_hour_sum += r.sales_per_hour * r.sales;
      t.sales_per_hour_weight += r.sales;
    }
  }

  return t;
}

/** Prefer direct ppvs_unlocked; fall back to fans_who_spent only when unlock fields were never synced. */
function resolveUnlock(t: Totals): {
  ratePct: number | null;
  sparse: boolean;
} {
  if (t.has_direct_unlock || t.ppvs_unlocked > 0) {
    if (t.ppvs_sent <= 0) return { ratePct: 0, sparse: false };
    return { ratePct: round2((t.ppvs_unlocked / t.ppvs_sent) * 100), sparse: false };
  }
  if (t.fans_who_spent > 0 && t.ppvs_sent > 0) {
    return { ratePct: round2((t.fans_who_spent / t.ppvs_sent) * 100), sparse: false };
  }
  if (t.ppvs_sent > 0) {
    return {
      ratePct: null,
      sparse: true,
    };
  }
  return { ratePct: 0, sparse: false };
}

function resolveGoldenRatioPct(t: Totals): { ratePct: number | null; sparse: boolean } {
  if (t.messages_sent <= 0) {
    return { ratePct: t.ppvs_sent > 0 ? null : 0, sparse: t.ppvs_sent > 0 };
  }
  if (t.golden_ratio_rows === 0 && t.ppvs_sent > 0) {
    return { ratePct: round2((t.ppvs_sent / t.messages_sent) * 100), sparse: false };
  }
  return { ratePct: round2((t.ppvs_sent / t.messages_sent) * 100), sparse: false };
}

function resolveRevPerHour(t: Totals): number {
  if (t.sales_per_hour_weight > 0) {
    return round2(t.sales_per_hour_sum / t.sales_per_hour_weight);
  }
  return 0;
}

function resolveRevPerFan(t: Totals): number {
  if (t.fans_chatted <= 0) return 0;
  return round2(t.sales / t.fans_chatted);
}

function valueFromTotals(metric: InflowwChallengeMetric, t: Totals): InflowwChallengeProgressResult {
  switch (metric) {
    case "infloww_sales":
      return { value: round2(t.sales) };
    case "infloww_ppv_sales":
      return { value: round2(t.ppv_sales) };
    case "infloww_tips":
      return { value: round2(t.tips) };
    case "infloww_messages":
      return { value: t.messages_sent };
    case "infloww_ppvs_sent":
      return { value: t.ppvs_sent };
    case "infloww_ppvs_unlocked":
      return { value: t.ppvs_unlocked };
    case "infloww_fans_chatted":
      return { value: t.fans_chatted };
    case "infloww_rev_per_hour":
      return { value: resolveRevPerHour(t) };
    case "infloww_rev_per_fan":
      return { value: resolveRevPerFan(t) };
    case "infloww_unlock_rate": {
      const { ratePct, sparse } = resolveUnlock(t);
      if (sparse || ratePct == null) {
        return {
          value: 0,
          unavailable: true,
          unavailable_reason: "Unlock data not yet synced for this period.",
        };
      }
      return { value: ratePct };
    }
    case "infloww_golden_ratio": {
      const { ratePct, sparse } = resolveGoldenRatioPct(t);
      if (sparse || ratePct == null) {
        return {
          value: 0,
          unavailable: true,
          unavailable_reason: "Not enough message data for golden ratio.",
        };
      }
      return { value: ratePct };
    }
    default:
      return { value: 0, unavailable: true, unavailable_reason: "Unknown metric." };
  }
}

/**
 * Fetch aggregated challenge progress for one Infloww metric over a date range.
 * Rate metrics return `unavailable: true` when data is sparse (never a fake 0%).
 */
export async function fetchProgress(
  metric: InflowwChallengeMetric,
  range: InflowwProgressRange,
  publicUserId: string
): Promise<InflowwChallengeProgressResult> {
  const link = await getUserInflowwLinkByPublicId(publicUserId.trim());
  if (!link || link.infloww_employee_id <= 0) {
    return {
      value: 0,
      unavailable: true,
      unavailable_reason: "Link your Infloww employee profile to track this challenge.",
    };
  }

  const startYmd = range.startYmd.trim().slice(0, 10);
  const endYmd = range.endYmd.trim().slice(0, 10);
  if (!startYmd || !endYmd) {
    return { value: 0, unavailable: true, unavailable_reason: "Invalid challenge dates." };
  }

  const rows = await queryInflowwDailyStats({
    userUuids: [link.uuid],
    startYmd,
    endYmd,
  });

  if (!rows.length) {
    const isRate = metric === "infloww_unlock_rate" || metric === "infloww_golden_ratio";
    if (isRate) {
      return {
        value: 0,
        unavailable: true,
        unavailable_reason: "No Infloww stats synced for this period yet.",
      };
    }
    return { value: 0 };
  }

  return valueFromTotals(metric, aggregateRows(rows));
}
