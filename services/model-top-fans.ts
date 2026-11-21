/**
 * Top Fans for a model — aggregates infloww_transactions by fan_id via RPC.
 */

import {
  addDaysAthensYmd,
  getTodayYmdAthens,
  athensYmdEndUtcMs,
  athensYmdStartUtcMs,
} from "@/lib/airtable-datetime";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

export type TopFansPeriodDays = 7 | 30 | 90 | "all";

export type ModelTopFanRow = {
  fan_id: string;
  fan_name: string;
  net: number;
  purchase_count: number;
  last_purchase_at: string | null;
  tips_net: number;
  messages_net: number;
  subscription_net: number;
  posts_net: number;
};

export type ModelTopFansSummary = {
  fan_count: number;
  total_net: number;
  /** 0–1 share of total net coming from the top 10 fans (by net). */
  top10_net_share: number;
};

export type ModelTopFansResult = {
  summary: ModelTopFansSummary;
  fans: ModelTopFanRow[];
  has_more: boolean;
  period_days: TopFansPeriodDays;
  start_iso: string | null;
  end_iso: string | null;
};

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function periodBounds(period: TopFansPeriodDays): {
  startIso: string | null;
  endIso: string | null;
} {
  if (period === "all") return { startIso: null, endIso: null };
  const endYmd = getTodayYmdAthens();
  const startYmd = addDaysAthensYmd(endYmd, -(period - 1));
  return {
    startIso: new Date(athensYmdStartUtcMs(startYmd)).toISOString(),
    endIso: new Date(athensYmdEndUtcMs(endYmd)).toISOString(),
  };
}

function mapFan(row: Record<string, unknown>): ModelTopFanRow {
  return {
    fan_id: String(row.fan_id ?? ""),
    fan_name: String(row.fan_name ?? row.fan_id ?? "—"),
    net: n(row.net),
    purchase_count: Math.max(0, Math.floor(n(row.purchase_count))),
    last_purchase_at: row.last_purchase_at ? String(row.last_purchase_at) : null,
    tips_net: n(row.tips_net),
    messages_net: n(row.messages_net),
    subscription_net: n(row.subscription_net),
    posts_net: n(row.posts_net),
  };
}

export async function listModelTopFans(params: {
  modelId: string;
  periodDays?: TopFansPeriodDays;
  search?: string;
  inactiveOnly?: boolean;
  inactiveMinNet?: number;
  inactiveDays?: number;
  limit?: number;
  offset?: number;
}): Promise<ModelTopFansResult> {
  const modelId = params.modelId.trim();
  if (!modelId) {
    return {
      summary: { fan_count: 0, total_net: 0, top10_net_share: 0 },
      fans: [],
      has_more: false,
      period_days: params.periodDays ?? 30,
      start_iso: null,
      end_iso: null,
    };
  }

  const periodDays = params.periodDays ?? 30;
  const { startIso, endIso } = periodBounds(periodDays);
  const limit = Math.min(500, Math.max(1, params.limit ?? 100));
  const offset = Math.max(0, params.offset ?? 0);
  const inactiveMinNet =
    typeof params.inactiveMinNet === "number" && Number.isFinite(params.inactiveMinNet)
      ? Math.max(0, params.inactiveMinNet)
      : 100;
  const inactiveDays =
    typeof params.inactiveDays === "number" && Number.isFinite(params.inactiveDays)
      ? Math.max(1, Math.floor(params.inactiveDays))
      : 14;

  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.rpc("infloww_model_top_fans", {
    p_model_id: modelId,
    p_start_iso: startIso,
    p_end_iso: endIso,
    p_search: params.search?.trim() || null,
    p_inactive_only: params.inactiveOnly === true,
    p_inactive_min_net: inactiveMinNet,
    p_inactive_days: inactiveDays,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    const msg = error.message || "RPC failed";
    if (/infloww_model_top_fans|Could not find the function|schema cache/i.test(msg)) {
      throw new Error(
        "Top Fans RPC is not installed yet. Apply migration supabase/migrations/20261121180000_infloww_model_top_fans.sql on the Gunzo Supabase project."
      );
    }
    throw new Error(`listModelTopFans: ${msg}`);
  }

  const payload = (data ?? {}) as {
    summary?: {
      fan_count?: number | string | null;
      total_net?: number | string | null;
      top10_net_share?: number | string | null;
    };
    fans?: Array<Record<string, unknown>> | null;
    has_more?: boolean;
  };

  const fansRaw = Array.isArray(payload.fans) ? payload.fans : [];
  return {
    summary: {
      fan_count: Math.max(0, Math.floor(n(payload.summary?.fan_count))),
      total_net: n(payload.summary?.total_net),
      top10_net_share: Math.max(0, Math.min(1, n(payload.summary?.top10_net_share))),
    },
    fans: fansRaw.map(mapFan).filter((f) => f.fan_id),
    has_more: payload.has_more === true,
    period_days: periodDays,
    start_iso: startIso,
    end_iso: endIso,
  };
}
