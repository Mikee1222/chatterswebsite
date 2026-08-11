/**
 * Client Gunzo Partnership — Infloww stats scoped to the client's linked model(s) only.
 * Never queries or returns data for models outside client_models assignments.
 */

import { previousPeriodRange } from "@/services/infloww-analytics";
import {
  computeAcquisitionEfficiency,
  computeChurnRisk,
  computeNetProfit,
  deriveModelCreatorAnalytics,
} from "@/services/infloww-creator-analytics";
import type { PeriodChangeMetric } from "@/services/infloww-analytics";
import {
  listCreatorDailyStats,
  listCreatorRefunds,
  listCreatorTransactions,
  listMarketingLinks,
  type CreatorDailyStatsRow,
  type CreatorTransactionRow,
} from "@/services/infloww-creator-earnings";
import { sbResolveUuidToAirtableMap } from "@/lib/supabase-data";
import { resolveInflowwStatsRange, type InflowwStatsPreset } from "@/services/infloww-performance";
import { getClientModels } from "@/services/client-portal";

export const CLIENT_PARTNERSHIP_STAT_INFO = {
  gross_revenue:
    "Total money your OnlyFans account earned in this period — tips, PPV unlocks, subscriptions, and messages.",
  net_revenue:
    "What you keep after platform fees and refunds — closer to your actual take-home.",
  period_change: "How this period compares to the same-length period right before it.",
  revenue_trend: "Daily revenue from synced transactions — see how your account momentum builds.",
  active_fans: "Fans with an active subscription right now (latest snapshot in this period).",
  new_fans: "Brand-new subscribers who joined during this period.",
  renewals: "Existing fans who renewed their subscription in this period.",
  auto_renew:
    "Share of active fans with auto-renew turned on — a healthy sign they plan to stay subscribed.",
  fan_trend: "New subscribers and renewals day by day — your audience growth rhythm.",
  platform_rank:
    "OnlyFans performance percentile from Infloww — lower % means you're closer to the top performers.",
  rank_trend: "How your platform standing moved across the period (when Infloww reports it).",
  marketing_links:
    "Your top trial and tracking links by revenue — see which promotions are pulling fans in.",
  revenue_per_sub: "Average gross revenue per fan who joined through that link.",
} as const;

export type ClientPartnershipDailyRevenuePoint = {
  date: string;
  gross: number;
};

export type ClientPartnershipFanTrendPoint = {
  date: string;
  new_subscribers: number;
  renewals: number;
  active_fans: number;
};

export type ClientPartnershipRankPoint = {
  date: string;
  rank: number;
};

export type ClientPartnershipMarketingRow = {
  link_id: string;
  link_type: string;
  message: string | null;
  sub_count: number;
  earnings_gross: number;
  revenue_per_sub: number | null;
};

export type ClientPartnershipInflowwStats = {
  linked: boolean;
  /** Client-facing model label(s) — never exposes other clients' models. */
  modelNames: string[];
  range: { startYmd: string; endYmd: string; preset: InflowwStatsPreset };
  revenue: {
    gross: number;
    net: number;
    fees: number;
    refunds: number;
    change: PeriodChangeMetric | null;
    dailyTrend: ClientPartnershipDailyRevenuePoint[];
  };
  fans: {
    active: number;
    new_subscribers: number;
    renewals: number;
    renew_on_share: number | null;
    renew_on_count: number | null;
    renew_on_label: string;
    dailyTrend: ClientPartnershipFanTrendPoint[];
  };
  ranking: {
    latest: number | null;
    trend: ClientPartnershipRankPoint[];
  };
  marketing: ClientPartnershipMarketingRow[];
};

const EMPTY_STATS = (
  range: { startYmd: string; endYmd: string; preset: InflowwStatsPreset }
): ClientPartnershipInflowwStats => ({
  linked: false,
  modelNames: [],
  range,
  revenue: {
    gross: 0,
    net: 0,
    fees: 0,
    refunds: 0,
    change: null,
    dailyTrend: [],
  },
  fans: {
    active: 0,
    new_subscribers: 0,
    renewals: 0,
    renew_on_share: null,
    renew_on_count: null,
    renew_on_label: "Fan data will appear once your account syncs.",
    dailyTrend: [],
  },
  ranking: { latest: null, trend: [] },
  marketing: [],
});

/** Resolve modelss record ids assigned to this client — sole source of Infloww scope. */
export async function resolveClientPartnershipModelIds(clientId: string): Promise<{
  modelRecordIds: string[];
  modelNames: string[];
}> {
  const assignments = await getClientModels(clientId);
  // client_models.model stores Supabase UUIDs; infloww_* tables use Airtable rec ids in model_record_id.
  const modelAt = await sbResolveUuidToAirtableMap(
    "modelss",
    assignments.map((a) => a.model)
  );
  const modelRecordIds = Array.from(
    new Set(
      assignments
        .flatMap((a) => a.model)
        .filter(Boolean)
        .map((uuid) => modelAt.get(uuid) ?? uuid)
    )
  );
  const modelNames = Array.from(
    new Set(
      assignments
        .map((a) => a.model_name?.trim())
        .filter((n): n is string => Boolean(n))
    )
  );
  return { modelRecordIds, modelNames };
}

function buildDailyRevenueTrend(transactions: CreatorTransactionRow[]): ClientPartnershipDailyRevenuePoint[] {
  const byDay = new Map<string, number>();
  for (const t of transactions) {
    const day = t.created_time?.slice(0, 10);
    if (!day) continue;
    byDay.set(day, (byDay.get(day) ?? 0) + t.amount);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, gross]) => ({ date, gross }));
}

function mergeDailyStats(rows: CreatorDailyStatsRow[]): CreatorDailyStatsRow[] {
  const byDate = new Map<string, CreatorDailyStatsRow>();
  for (const r of rows) {
    const cur = byDate.get(r.date);
    if (!cur) {
      byDate.set(r.date, { ...r });
      continue;
    }
    cur.profile_visitors += r.profile_visitors;
    cur.active_fans += r.active_fans;
    cur.expired_fans += r.expired_fans;
    cur.new_subscribers += r.new_subscribers;
    cur.renewals += r.renewals;
    cur.messages_sent += r.messages_sent;
    if (r.fans_with_renew_on != null) {
      cur.fans_with_renew_on = (cur.fans_with_renew_on ?? 0) + r.fans_with_renew_on;
    }
    if (r.performance_rank != null) {
      const prev = cur.performance_rank;
      cur.performance_rank =
        prev == null ? r.performance_rank : (prev + r.performance_rank) / 2;
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function buildFanTrend(daily: CreatorDailyStatsRow[]): ClientPartnershipFanTrendPoint[] {
  return daily.map((d) => ({
    date: d.date,
    new_subscribers: d.new_subscribers,
    renewals: d.renewals,
    active_fans: d.active_fans,
  }));
}

function buildRankTrend(daily: CreatorDailyStatsRow[]): ClientPartnershipRankPoint[] {
  return daily
    .filter((d) => d.performance_rank != null)
    .map((d) => ({ date: d.date, rank: d.performance_rank as number }));
}

async function fetchScopedRows(
  modelRecordIds: string[],
  range: { startYmd: string; endYmd: string },
  prev: { startYmd: string; endYmd: string }
) {
  const dailyChunks = await Promise.all(
    modelRecordIds.map((id) =>
      listCreatorDailyStats({
        startYmd: range.startYmd,
        endYmd: range.endYmd,
        modelRecordId: id,
      })
    )
  );
  const txChunks = await Promise.all(
    modelRecordIds.map((id) =>
      listCreatorTransactions({
        startYmd: range.startYmd,
        endYmd: range.endYmd,
        modelRecordId: id,
        limit: 2000,
      })
    )
  );
  const refundChunks = await Promise.all(
    modelRecordIds.map((id) =>
      listCreatorRefunds({
        startYmd: range.startYmd,
        endYmd: range.endYmd,
        modelRecordId: id,
        limit: 300,
      })
    )
  );
  const prevTxChunks = await Promise.all(
    modelRecordIds.map((id) =>
      listCreatorTransactions({
        startYmd: prev.startYmd,
        endYmd: prev.endYmd,
        modelRecordId: id,
        limit: 1500,
      })
    )
  );
  const marketingChunks = await Promise.all(
    modelRecordIds.map((id) =>
      listMarketingLinks({
        modelRecordId: id,
        excludeLinkTypes: ["CAMPAIGN"],
      })
    )
  );

  const daily = mergeDailyStats(dailyChunks.flat());
  const transactions = txChunks.flat();
  const refunds = refundChunks.flat();
  const prevGross = prevTxChunks.flat().reduce((s, t) => s + t.amount, 0);

  const marketing = computeAcquisitionEfficiency(marketingChunks.flat())
    .sort((a, b) => b.earnings_gross - a.earnings_gross)
    .slice(0, 8)
    .map((l) => ({
      link_id: l.link_id,
      link_type: l.link_type,
      message: l.message,
      sub_count: l.sub_count,
      earnings_gross: l.earnings_gross,
      revenue_per_sub: l.revenue_per_sub,
    }));

  return { daily, transactions, refunds, prevGross, marketing };
}

/**
 * Infloww partnership stats for a client — strictly limited to models in client_models.
 */
export async function getClientPartnershipInflowwStats(
  clientId: string,
  preset: InflowwStatsPreset = "this_month",
  customStart?: string,
  customEnd?: string
): Promise<ClientPartnershipInflowwStats> {
  const range = resolveInflowwStatsRange(preset, customStart, customEnd);
  const prev = previousPeriodRange(range.startYmd, range.endYmd);

  const { modelRecordIds, modelNames } = await resolveClientPartnershipModelIds(clientId);
  if (modelRecordIds.length === 0) {
    return { ...EMPTY_STATS({ ...range, preset }), modelNames: [] };
  }

  const { daily, transactions, refunds, prevGross, marketing } = await fetchScopedRows(
    modelRecordIds,
    range,
    prev
  );

  const linked =
    daily.length > 0 ||
    transactions.length > 0 ||
    marketing.some((m) => m.earnings_gross > 0 || m.sub_count > 0);

  if (!linked) {
    return {
      ...EMPTY_STATS({ ...range, preset }),
      modelNames,
    };
  }

  const primaryModelId = modelRecordIds[0] ?? null;
  const creatorInflowwId =
    daily[0]?.creator_infloww_id ?? transactions[0]?.creator_infloww_id ?? "client-scoped";

  const analytics = deriveModelCreatorAnalytics({
    creatorInflowwId,
    modelRecordId: primaryModelId,
    modelName: modelNames[0] ?? "Your account",
    daily,
    transactions,
    refunds,
    previousGross: prevGross,
  });

  const latest =
    daily.length > 0 ? daily.reduce((a, b) => (a.date >= b.date ? a : b)) : null;
  const churn = computeChurnRisk({
    active_fans: latest?.active_fans ?? analytics.churn.active_fans,
    fans_with_renew_on: latest?.fans_with_renew_on ?? analytics.churn.fans_with_renew_on,
  });

  const profit = computeNetProfit({ transactions, refunds });

  return {
    linked: true,
    modelNames,
    range: { ...range, preset },
    revenue: {
      gross: profit.gross,
      net: profit.net_profit,
      fees: profit.fees,
      refunds: profit.refunds,
      change: analytics.revenue_change,
      dailyTrend: buildDailyRevenueTrend(transactions),
    },
    fans: {
      active: churn.active_fans,
      new_subscribers: analytics.growth.new_subscribers,
      renewals: analytics.growth.renewals,
      renew_on_share: churn.renew_on_share,
      renew_on_count: churn.fans_with_renew_on,
      renew_on_label: churn.label,
      dailyTrend: buildFanTrend(daily),
    },
    ranking: {
      latest: analytics.growth.latest_rank,
      trend: buildRankTrend(daily),
    },
    marketing,
  };
}
