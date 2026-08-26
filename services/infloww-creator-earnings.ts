/**
 * Supabase sync for creator-level Infloww data (earnings, marketing, creator-report).
 * Distinct from employee/chatter `infloww_daily_stats`.
 *
 * Matching: Infloww creator ids ≠ modelss.model_id (app-stable `model_*` ids).
 * Prefer `modelss.infloww_creator_id` (stable) when set; else fall back to
 * creator.id === model_id (rare), of_user_id === platformPid, or unique name.
 */

import {
  addDaysAthensYmd,
  athensYmdStartUtcMs,
  athensYmdEndUtcMs,
  ymdInAthens,
} from "@/lib/airtable-datetime";
import {
  EMPLOYEE_REPORT_MAX_LOOKBACK_DAYS,
  fetchAllCreatorLinkTypes,
  fetchCreatorChatSummary,
  fetchCreatorFansCount,
  fetchCreatorFansRenewOn,
  fetchCreatorProfileVisitors,
  fetchCreatorRank,
  fetchCreatorRefunds,
  fetchCreatorSubscriberCount,
  fetchCreatorTransactions,
  fetchLinkFans,
  fetchPriorityMassMessages,
  fetchTransactionPerfDetails,
  getInflowwModels,
  inflowwReportTodayYmd,
  InflowwApiError,
  logInflowwFailure,
  mergeCreatorDayStats,
} from "@/lib/infloww-api";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { listAllModelss } from "@/services/modelss";
import type {
  InflowwCreatorDayStats,
  InflowwCreatorTransaction,
  InflowwLinkType,
  InflowwMarketingLink,
  InflowwModel,
  InflowwPriorityMassMessage,
  InflowwRefund,
  InflowwTransactionPerfDetail,
} from "@/types/infloww";
import type { ModelRecord } from "@/types";

const LOADING_RESYNC_MIN_MS = 12 * 60 * 60 * 1000;
/** Supabase PostgREST max rows per request. */
const SUPABASE_PAGE_SIZE = 1000;

/**
 * Statuses that count toward creator revenue / Net Profit.
 * Infloww dashboard "Total earnings" includes both settled (`done`) and still-settling
 * (`loading`) payments; exclude undo/pending_return/etc.
 */
export const CREATOR_TX_REVENUE_STATUSES = ["done", "loading"] as const;

export function isCreatorTxRevenueCountable(status: string | null | undefined): boolean {
  const s = (status ?? "").trim().toLowerCase();
  return s === "done" || s === "loading";
}

/**
 * Drop `/transactions` hex twins when a canonical (usually numeric / perf) row already
 * exists: twin.infloww_row_id === canonical.transaction_id.
 */
export function dedupeCreatorTransactionsForRevenue<
  T extends { transaction_id: string; infloww_row_id?: string | null },
>(rows: T[]): T[] {
  if (rows.length < 2) return rows;
  const ids = new Set(rows.map((r) => r.transaction_id));
  const isHex32 = (id: string) => /^[a-f0-9]{32}$/i.test(id);
  return rows.filter((r) => {
    // Only drop list-endpoint hex twins; numeric perf row ids can collide across payments.
    if (!isHex32(r.transaction_id)) return true;
    const link = (r.infloww_row_id ?? "").trim();
    if (!link || link === r.transaction_id) return true;
    return !ids.has(link);
  });
}

/**
 * Pre-OnlyFans-fee fan payment for a transaction row (`amount`).
 * Used for Creator Earnings "Gross" so Fees can be subtracted into Net Profit
 * without double-counting the OF cut already reflected in `net`.
 */
export function creatorTxGrossAmount(row: { amount: number }): number {
  return Number.isFinite(row.amount) ? Math.max(0, row.amount) : 0;
}

/**
 * Creator earnings in dollars for a transaction row — matches Infloww dashboard
 * category totals (creator share after OnlyFans platform fee). Prefer `net`; fall
 * back to amount − fee when net is missing.
 */
export function creatorTxRevenueAmount(row: {
  amount: number;
  fee: number;
  net: number;
}): number {
  if (row.net > 0) return row.net;
  const fee = row.fee > 0 ? row.fee : 0;
  return Math.max(0, row.amount - fee);
}

/** Athens (+3) created_time ISO bounds for an Infloww stats YMD range. */
export function inflowwStatsRangeToCreatedTimeIso(params: {
  startYmd: string;
  endYmd: string;
}): { startIso: string; endIso: string } {
  return {
    startIso: new Date(athensYmdStartUtcMs(params.startYmd)).toISOString(),
    endIso: new Date(athensYmdEndUtcMs(params.endYmd)).toISOString(),
  };
}

/** Sum creator-share revenue for transaction rows (matches Infloww dashboard totals). */
export function sumCreatorTxRevenue(
  rows: Array<{ amount: number; fee: number; net: number }>
): number {
  return rows.reduce((s, t) => s + creatorTxRevenueAmount(t), 0);
}

/** Refund totals keyed by transaction id (multiple partial refunds sum). */
export function refundsByTransactionId(
  refunds: Array<{ transaction_id: string; payment_amount: number }>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of refunds) {
    const id = (r.transaction_id ?? "").trim();
    if (!id) continue;
    map.set(id, (map.get(id) ?? 0) + r.payment_amount);
  }
  return map;
}

/** Creator gross for one tx minus any linked refund rows. */
export function creatorTxNetAfterRefunds(
  row: { amount: number; fee: number; net: number; transaction_id?: string },
  refundByTxId: Map<string, number>
): number {
  const gross = creatorTxRevenueAmount(row);
  const txId = (row.transaction_id ?? "").trim();
  const refunded = txId ? (refundByTxId.get(txId) ?? 0) : 0;
  return Math.max(0, gross - refunded);
}

/** Filter pre-fetched txs to an Infloww stats YMD range on the Athens calendar. */
export function filterCreatorTransactionsInAthensYmdRange<
  T extends { created_time: string | null },
>(rows: T[], startYmd: string, endYmd: string): T[] {
  return rows.filter((t) => {
    if (!t.created_time) return false;
    const ymd = ymdInAthens(t.created_time);
    if (!ymd) return false;
    return ymd >= startYmd && ymd <= endYmd;
  });
}

export type LinkedCreatorModel = {
  creatorInflowwId: string;
  platformPid?: string;
  creatorName: string;
  modelRecordId: string;
  modelStableId: string;
  modelName: string;
};

export type CreatorSyncSectionResult = {
  upserted: number;
  errors: Array<{ creatorId?: string; message: string; status?: number; path?: string }>;
};

export type CreatorEarningsSyncResult = {
  startYmd: string;
  endYmd: string;
  creatorsTargeted: number;
  unmatchedModels: number;
  dailyStats: CreatorSyncSectionResult;
  transactions: CreatorSyncSectionResult;
  marketingLinks: CreatorSyncSectionResult;
  linkFans: CreatorSyncSectionResult;
  refunds: CreatorSyncSectionResult;
  priorityMassMessages: CreatorSyncSectionResult;
};

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function isoFromMs(ms: number): string | null {
  if (!ms || ms <= 0) return null;
  return new Date(ms).toISOString();
}

/** Match app models to Infloww creators. Prefer stable `infloww_creator_id` when set. */
export function matchModelsToInflowwCreators(
  models: ModelRecord[],
  creators: InflowwModel[]
): { linked: LinkedCreatorModel[]; unmatched: ModelRecord[] } {
  const byId = new Map(creators.map((c) => [c.id, c]));
  const byPid = new Map(
    creators.filter((c) => c.platformPid).map((c) => [String(c.platformPid), c] as const)
  );
  const byName = new Map<string, InflowwModel[]>();
  for (const c of creators) {
    const k = c.name.trim().toLowerCase();
    if (!k) continue;
    const list = byName.get(k) ?? [];
    list.push(c);
    byName.set(k, list);
  }

  const usedCreatorIds = new Set<string>();
  const linked: LinkedCreatorModel[] = [];
  const unmatched: ModelRecord[] = [];

  const candidates = models.filter((m) => Boolean(m.model_id?.trim()));

  // Pass 1: stable infloww_creator_id (always wins when present + valid)
  for (const m of candidates) {
    const creatorId = (m.infloww_creator_id ?? "").trim();
    if (!creatorId) continue;
    const creator = byId.get(creatorId);
    if (!creator || usedCreatorIds.has(creator.id)) continue;
    usedCreatorIds.add(creator.id);
    linked.push({
      creatorInflowwId: creator.id,
      platformPid: creator.platformPid,
      creatorName: creator.name,
      modelRecordId: m.id,
      modelStableId: m.model_id.trim(),
      modelName: m.model_name?.trim() || creator.name,
    });
  }

  const linkedRecordIds = new Set(linked.map((l) => l.modelRecordId));

  // Pass 2: fuzzy fallback only when infloww_creator_id is unset
  for (const m of candidates) {
    if (linkedRecordIds.has(m.id)) continue;
    if ((m.infloww_creator_id ?? "").trim()) {
      // Set but invalid / already claimed → unmatched
      unmatched.push(m);
      continue;
    }

    const stableId = m.model_id.trim();
    const ofUid = (m.of_user_id ?? "").trim();
    const nameKey = (m.model_name ?? "").trim().toLowerCase();

    let creator: InflowwModel | undefined = byId.get(stableId);
    if (!creator && ofUid) creator = byPid.get(ofUid);
    if (!creator && nameKey) {
      const nameMatches = (byName.get(nameKey) ?? []).filter((c) => !usedCreatorIds.has(c.id));
      if (nameMatches.length === 1) creator = nameMatches[0];
    }

    if (!creator || usedCreatorIds.has(creator.id)) {
      unmatched.push(m);
      continue;
    }
    usedCreatorIds.add(creator.id);
    linked.push({
      creatorInflowwId: creator.id,
      platformPid: creator.platformPid,
      creatorName: creator.name,
      modelRecordId: m.id,
      modelStableId: stableId,
      modelName: m.model_name?.trim() || creator.name,
    });
  }

  return { linked, unmatched };
}

export async function listLinkedCreatorModels(): Promise<{
  linked: LinkedCreatorModel[];
  unmatchedCount: number;
}> {
  const [models, creators] = await Promise.all([listAllModelss(), getInflowwModels()]);
  const { linked, unmatched } = matchModelsToInflowwCreators(models, creators);
  return { linked, unmatchedCount: unmatched.length };
}

async function upsertCreatorDailyStats(
  linked: LinkedCreatorModel[],
  rows: InflowwCreatorDayStats[]
): Promise<number> {
  if (!rows.length) return 0;
  const byCreator = new Map(linked.map((l) => [l.creatorInflowwId, l]));
  const byPid = new Map(
    linked.filter((l) => l.platformPid).map((l) => [String(l.platformPid), l] as const)
  );
  const now = new Date().toISOString();
  const payload = rows.map((r) => {
    const link =
      byCreator.get(r.creatorId) ??
      (r.platformPid ? byPid.get(r.platformPid) : undefined);
    return {
      creator_infloww_id: link?.creatorInflowwId ?? r.creatorId,
      model_record_id: link?.modelRecordId ?? null,
      model_stable_id: link?.modelStableId ?? null,
      model_name: link?.modelName ?? null,
      date: r.date,
      performance_rank: r.performanceRank,
      profile_visitors: r.profileVisitors,
      guest_visitors: r.guestVisitors,
      logged_in_visitors: r.loggedInVisitors,
      active_fans: r.activeFans,
      expired_fans: r.expiredFans,
      new_subscribers: r.newSubscribers,
      renewals: r.renewals,
      messages_sent: r.messagesSent,
      ppvs_sent: r.ppvsSent,
      fans_chatted: r.fansChatted,
      reply_time_ms: r.replyTimeMs,
      fans_with_renew_on: r.fansWithRenewOn,
      synced_at: now,
      updated_at: now,
    };
  });

  const sb = getSupabaseServiceClient();
  const { error, count } = await sb.from("infloww_creator_daily_stats").upsert(payload, {
    onConflict: "creator_infloww_id,date",
    count: "exact",
  });
  if (error) throw new Error(`upsert infloww_creator_daily_stats: ${error.message}`);
  return count ?? payload.length;
}

function txUpsertPayload(
  link: LinkedCreatorModel,
  tx: InflowwCreatorTransaction,
  perf?: InflowwTransactionPerfDetail,
  opts?: { markLoadingSync?: boolean }
) {
  const now = new Date().toISOString();
  const status = (perf?.status ?? tx.status ?? "").toLowerCase() || null;
  return {
    transaction_id: tx.transactionId,
    infloww_row_id: tx.inflowwRowId ?? perf?.inflowwRowId ?? null,
    creator_infloww_id: link.creatorInflowwId,
    model_record_id: link.modelRecordId,
    model_stable_id: link.modelStableId,
    platform_pid: tx.platformPid ?? perf?.platformPid ?? link.platformPid ?? null,
    fan_id: tx.fanId ?? perf?.fanId ?? null,
    fan_name: tx.fanName ?? perf?.fanName ?? null,
    created_time: isoFromMs(tx.createdTimeMs || perf?.createdTimeMs || 0),
    type: tx.type ?? perf?.type ?? null,
    tip_source: tx.tipSource ?? perf?.tipSource ?? null,
    status,
    amount: tx.amount || perf?.amount || 0,
    fee: tx.fee || perf?.fee || 0,
    net: tx.net || perf?.net || 0,
    currency: tx.currency || perf?.currency || "USD",
    sales_rule: perf?.salesRule ?? null,
    attribute_employee_id: perf?.attributeEmployeeId ?? null,
    sales_amount: perf?.salesAmount ?? null,
    last_loading_sync_at:
      opts?.markLoadingSync || status === "loading" ? now : undefined,
    synced_at: now,
    updated_at: now,
  };
}

async function upsertTransactions(
  link: LinkedCreatorModel,
  txs: InflowwCreatorTransaction[],
  perfByTxId: Map<string, InflowwTransactionPerfDetail>
): Promise<number> {
  if (!txs.length && !perfByTxId.size) return 0;
  const byId = new Map(txs.map((t) => [t.transactionId, t]));
  /** inflowwRowId → key currently in byId (list endpoint often stores numeric id here). */
  const byInflowwRowId = new Map<string, string>();
  for (const t of byId.values()) {
    if (t.inflowwRowId) byInflowwRowId.set(t.inflowwRowId, t.transactionId);
  }
  for (const [id, p] of perfByTxId) {
    if (byId.has(id)) continue;
    const listKey = byInflowwRowId.get(id);
    if (listKey && byId.has(listKey)) {
      // Same payment: re-key list row onto canonical perf transactionId so upsert merges.
      const existing = byId.get(listKey)!;
      byId.delete(listKey);
      byId.set(id, {
        ...existing,
        transactionId: id,
        inflowwRowId: p.inflowwRowId ?? existing.inflowwRowId,
        platformPid: existing.platformPid ?? p.platformPid,
        fanId: existing.fanId ?? p.fanId,
        fanName: existing.fanName ?? p.fanName,
        createdTimeMs: existing.createdTimeMs || p.createdTimeMs,
        type: existing.type ?? p.type,
        tipSource: existing.tipSource ?? p.tipSource,
        status: p.status || existing.status,
        amount: existing.amount || p.amount,
        fee: existing.fee || p.fee,
        net: existing.net || p.net,
        currency: existing.currency || p.currency,
      });
      continue;
    }
    byId.set(id, {
      transactionId: p.transactionId,
      inflowwRowId: p.inflowwRowId,
      creatorId: p.creatorId,
      platformPid: p.platformPid,
      fanId: p.fanId,
      fanName: p.fanName,
      createdTimeMs: p.createdTimeMs,
      type: p.type,
      tipSource: p.tipSource,
      status: p.status,
      amount: p.amount,
      fee: p.fee,
      net: p.net,
      currency: p.currency,
    });
  }
  // Final safety: never persist hex list ids when inflowwRowId is the numeric payment id.
  for (const [key, t] of [...byId.entries()]) {
    const link = (t.inflowwRowId ?? "").trim();
    if (!/^[a-f0-9]{32}$/i.test(key) || !/^\d+$/.test(link)) continue;
    byId.delete(key);
    if (!byId.has(link)) {
      byId.set(link, { ...t, transactionId: link });
    }
  }
  const payload = [...byId.values()].map((tx) =>
    txUpsertPayload(link, tx, perfByTxId.get(tx.transactionId), { markLoadingSync: true })
  );
  // Strip undefined last_loading_sync_at for done rows we don't want to overwrite incorrectly —
  // use explicit null/omit: supabase prefers omitting keys we don't want to clear.
  const cleaned = payload.map((row) => {
    const out = { ...row };
    if (out.last_loading_sync_at === undefined) delete (out as { last_loading_sync_at?: string }).last_loading_sync_at;
    return out;
  });

  const sb = getSupabaseServiceClient();
  const { error, count } = await sb.from("infloww_transactions").upsert(cleaned, {
    onConflict: "transaction_id",
    count: "exact",
  });
  if (error) throw new Error(`upsert infloww_transactions: ${error.message}`);
  return count ?? cleaned.length;
}

async function upsertMarketingLinks(
  link: LinkedCreatorModel,
  links: InflowwMarketingLink[]
): Promise<Map<string, string>> {
  /** infloww_link_id → uuid */
  const idMap = new Map<string, string>();
  if (!links.length) return idMap;
  const now = new Date().toISOString();
  const payload = links.map((l) => ({
    model_id: link.modelRecordId,
    creator_infloww_id: link.creatorInflowwId,
    infloww_link_id: l.linkId,
    link_type: l.linkType,
    message: l.message ?? null,
    campaign_type: l.campaignType ?? null,
    sub_count: l.subCount,
    sub_limit: l.subLimit,
    sub_duration: l.subDuration,
    discount: l.discount,
    finished_flag: l.finishedFlag,
    earnings_gross: l.earningsGross,
    earnings_net: l.earningsNet,
    paying_fans_count: l.payingFansCount,
    currency: l.currency,
    link_created_time: isoFromMs(l.createdTimeMs),
    expired_time: l.expiredTimeMs ? isoFromMs(l.expiredTimeMs) : null,
    link_updated_time: l.updatedTimeMs ? isoFromMs(l.updatedTimeMs) : null,
    synced_at: now,
    updated_at: now,
  }));

  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("infloww_marketing_links")
    .upsert(payload, { onConflict: "model_id,infloww_link_id" })
    .select("id, infloww_link_id");
  if (error) throw new Error(`upsert infloww_marketing_links: ${error.message}`);
  for (const row of data ?? []) {
    idMap.set(String(row.infloww_link_id), String(row.id));
  }
  return idMap;
}

async function upsertLinkFans(
  link: LinkedCreatorModel,
  linkType: InflowwLinkType,
  marketingLinkUuidByInflowwId: Map<string, string>,
  fansByLinkId: Map<string, Awaited<ReturnType<typeof fetchLinkFans>>>
): Promise<number> {
  const now = new Date().toISOString();
  const payload: Record<string, unknown>[] = [];
  for (const [linkId, fans] of fansByLinkId) {
    for (const f of fans) {
      payload.push({
        link_id: linkId,
        marketing_link_uuid: marketingLinkUuidByInflowwId.get(linkId) ?? null,
        creator_infloww_id: link.creatorInflowwId,
        model_id: link.modelRecordId,
        fan_id: f.fanId,
        fan_name: f.fanName ?? null,
        subscription_earning_gross: f.subscriptionEarningGross,
        subscription_earning_net: f.subscriptionEarningNet,
        posts_earning_gross: f.postsEarningGross,
        posts_earning_net: f.postsEarningNet,
        messages_earning_gross: f.messagesEarningGross,
        messages_earning_net: f.messagesEarningNet,
        streams_earning_gross: f.streamsEarningGross,
        streams_earning_net: f.streamsEarningNet,
        tips_earning_gross: f.tipsEarningGross,
        tips_earning_net: f.tipsEarningNet,
        currency: f.currency,
        subscribed_time: f.subscribedTimeMs ? isoFromMs(f.subscribedTimeMs) : null,
        synced_at: now,
        updated_at: now,
      });
    }
  }
  void linkType;
  if (!payload.length) return 0;
  const sb = getSupabaseServiceClient();
  const { error, count } = await sb.from("infloww_link_fans").upsert(payload, {
    onConflict: "link_id,fan_id",
    count: "exact",
  });
  if (error) throw new Error(`upsert infloww_link_fans: ${error.message}`);
  return count ?? payload.length;
}

async function syncCreatorReportSection(
  linked: LinkedCreatorModel[],
  startYmd: string,
  endYmd: string
): Promise<CreatorSyncSectionResult> {
  const result: CreatorSyncSectionResult = { upserted: 0, errors: [] };
  if (!linked.length) return result;
  const creatorIds = linked.map((l) => l.creatorInflowwId);
  const creatorIdByPlatformPid = new Map<string, string>();
  for (const l of linked) {
    if (l.platformPid) creatorIdByPlatformPid.set(l.platformPid, l.creatorInflowwId);
  }

  try {
    const [ranks, visitors, fans, subscribers, chat, renewOn] = await Promise.all([
      fetchCreatorRank({ creatorIds, startYmd, endYmd }),
      fetchCreatorProfileVisitors({ creatorIds, startYmd, endYmd }),
      fetchCreatorFansCount({ creatorIds, startYmd, endYmd }),
      fetchCreatorSubscriberCount({ creatorIds, startYmd, endYmd }),
      fetchCreatorChatSummary({ creatorIds, startYmd, endYmd, dayByDay: true }),
      fetchCreatorFansRenewOn({ creatorIds, startYmd, endYmd }),
    ]);
    const merged = mergeCreatorDayStats({
      creatorIdByPlatformPid,
      ranks,
      visitors,
      fans,
      subscribers,
      chat,
      renewOn,
    });
    result.upserted = await upsertCreatorDailyStats(linked, merged);
  } catch (err) {
    logInflowwFailure("syncCreatorReportSection", err);
    result.errors.push({
      message: err instanceof Error ? err.message : String(err),
      status: err instanceof InflowwApiError ? err.status : undefined,
      path: err instanceof InflowwApiError ? err.path : undefined,
    });
  }
  return result;
}

async function syncTransactionsSection(
  linked: LinkedCreatorModel[],
  startYmd: string,
  endYmd: string
): Promise<CreatorSyncSectionResult> {
  const result: CreatorSyncSectionResult = { upserted: 0, errors: [] };
  let startMs = athensYmdStartUtcMs(startYmd);
  let endMs = athensYmdEndUtcMs(endYmd);
  const safeEnd = Date.now() - 2000;
  if (endMs > safeEnd) endMs = safeEnd;
  if (endMs < startMs) startMs = endMs;

  for (const link of linked) {
    try {
      const [txs, perf] = await Promise.all([
        fetchCreatorTransactions({
          creatorId: link.creatorInflowwId,
          startMs,
          endMs,
        }),
        fetchTransactionPerfDetails({
          creatorId: link.creatorInflowwId,
          startYmd,
          endYmd,
        }),
      ]);
      const perfByTxId = new Map(perf.map((p) => [p.transactionId, p]));
      result.upserted += await upsertTransactions(link, txs, perfByTxId);
    } catch (err) {
      logInflowwFailure("syncTransactionsSection", err, { creatorId: link.creatorInflowwId });
      result.errors.push({
        creatorId: link.creatorInflowwId,
        message: err instanceof Error ? err.message : String(err),
        status: err instanceof InflowwApiError ? err.status : undefined,
        path: err instanceof InflowwApiError ? err.path : undefined,
      });
    }
  }

  // Re-sync loading transactions older than ~12h (status may have resolved).
  try {
    const sb = getSupabaseServiceClient();
    const cutoff = new Date(Date.now() - LOADING_RESYNC_MIN_MS).toISOString();
    const { data: loadingRows, error } = await sb
      .from("infloww_transactions")
      .select("transaction_id, creator_infloww_id, created_time, last_loading_sync_at")
      .eq("status", "loading")
      .or(`last_loading_sync_at.is.null,last_loading_sync_at.lt."${cutoff}"`)
      .limit(200);
    if (error) throw new Error(error.message);
    const byCreator = new Map<string, typeof loadingRows>();
    for (const row of loadingRows ?? []) {
      const cid = String(row.creator_infloww_id);
      const list = byCreator.get(cid) ?? [];
      list.push(row);
      byCreator.set(cid, list);
    }
    for (const [creatorId, rows] of byCreator) {
      const link = linked.find((l) => l.creatorInflowwId === creatorId);
      if (!link || !rows?.length) continue;
      const times = rows
        .map((r) => (r.created_time ? Date.parse(String(r.created_time)) : NaN))
        .filter((t) => Number.isFinite(t)) as number[];
      if (!times.length) continue;
      const minMs = Math.min(...times) - 60_000;
      const maxMs = Math.min(Math.max(...times) + 60_000, Date.now() - 2000);
      try {
        const [txs, perf] = await Promise.all([
          fetchCreatorTransactions({ creatorId, startMs: minMs, endMs: maxMs }),
          fetchTransactionPerfDetails({
            creatorId,
            startYmd: new Date(minMs).toISOString().slice(0, 10),
            endYmd: new Date(maxMs).toISOString().slice(0, 10),
          }),
        ]);
        const want = new Set(rows.map((r) => String(r.transaction_id)));
        const filteredTxs = txs.filter((t) => want.has(t.transactionId));
        const perfByTxId = new Map(
          perf.filter((p) => want.has(p.transactionId)).map((p) => [p.transactionId, p])
        );
        result.upserted += await upsertTransactions(link, filteredTxs, perfByTxId);
      } catch (err) {
        logInflowwFailure("resyncLoadingTransactions", err, { creatorId });
        result.errors.push({
          creatorId,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    logInflowwFailure("loadingTransactionResync", err);
    result.errors.push({
      message: err instanceof Error ? err.message : String(err),
    });
  }

  return result;
}

async function syncMarketingSection(
  linked: LinkedCreatorModel[]
): Promise<{ links: CreatorSyncSectionResult; fans: CreatorSyncSectionResult }> {
  const linksResult: CreatorSyncSectionResult = { upserted: 0, errors: [] };
  const fansResult: CreatorSyncSectionResult = { upserted: 0, errors: [] };

  for (const link of linked) {
    try {
      const allLinks = await fetchAllCreatorLinkTypes(link.creatorInflowwId);
      const idMap = await upsertMarketingLinks(link, allLinks);
      linksResult.upserted += allLinks.length;

      const fansByLinkId = new Map<string, Awaited<ReturnType<typeof fetchLinkFans>>>();
      for (const ml of allLinks) {
        // Prefer links with activity; still sync empty for completeness on small sets.
        try {
          const fans = await fetchLinkFans({
            creatorId: link.creatorInflowwId,
            linkId: ml.linkId,
            linkType: ml.linkType,
          });
          if (fans.length) fansByLinkId.set(ml.linkId, fans);
        } catch (err) {
          logInflowwFailure("fetchLinkFans", err, { linkId: ml.linkId });
          fansResult.errors.push({
            creatorId: link.creatorInflowwId,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
      fansResult.upserted += await upsertLinkFans(link, "CAMPAIGN", idMap, fansByLinkId);
    } catch (err) {
      logInflowwFailure("syncMarketingSection", err, { creatorId: link.creatorInflowwId });
      linksResult.errors.push({
        creatorId: link.creatorInflowwId,
        message: err instanceof Error ? err.message : String(err),
        status: err instanceof InflowwApiError ? err.status : undefined,
        path: err instanceof InflowwApiError ? err.path : undefined,
      });
    }
  }

  return { links: linksResult, fans: fansResult };
}

async function upsertRefunds(link: LinkedCreatorModel, refunds: InflowwRefund[]): Promise<number> {
  if (!refunds.length) return 0;
  const now = new Date().toISOString();
  const payload = refunds.map((r) => ({
    refund_id: r.refundId,
    transaction_id: r.transactionId,
    creator_infloww_id: link.creatorInflowwId,
    model_record_id: link.modelRecordId,
    model_stable_id: link.modelStableId,
    fan_id: r.fanId ?? null,
    payment_amount: r.paymentAmount,
    transaction_type: r.transactionType ?? null,
    payment_status: r.paymentStatus ?? null,
    currency: r.currency || "USD",
    payment_time: r.paymentTimeMs ? isoFromMs(r.paymentTimeMs) : null,
    refund_time: isoFromMs(r.refundTimeMs) ?? now,
    synced_at: now,
    updated_at: now,
  }));
  const sb = getSupabaseServiceClient();
  const { error, count } = await sb.from("infloww_refunds").upsert(payload, {
    onConflict: "refund_id",
    count: "exact",
  });
  if (error) throw new Error(`upsert infloww_refunds: ${error.message}`);
  return count ?? payload.length;
}

async function upsertPriorityMassMessages(
  link: LinkedCreatorModel,
  rows: InflowwPriorityMassMessage[]
): Promise<number> {
  if (!rows.length) return 0;
  const now = new Date().toISOString();
  const payload = rows.map((r) => ({
    priority_mass_message_id: r.priorityMassMessageId,
    creator_infloww_id: link.creatorInflowwId,
    model_record_id: link.modelRecordId,
    model_stable_id: link.modelStableId,
    employee_id: r.employeeId ?? null,
    status: r.status ?? null,
    price: r.price,
    revenue: r.revenue,
    number_of_times_sent: r.numberOfTimesSent,
    number_of_purchases: r.numberOfPurchases,
    targeting_rules: r.targetingRules ?? null,
    message_preview: r.messagePreview ?? null,
    currency: r.currency || "USD",
    created_time: r.createdTimeMs ? isoFromMs(r.createdTimeMs) : null,
    sent_time: r.sentTimeMs ? isoFromMs(r.sentTimeMs) : null,
    synced_at: now,
    updated_at: now,
  }));
  const sb = getSupabaseServiceClient();
  const { error, count } = await sb.from("infloww_priority_mass_messages").upsert(payload, {
    onConflict: "priority_mass_message_id",
    count: "exact",
  });
  if (error) throw new Error(`upsert infloww_priority_mass_messages: ${error.message}`);
  return count ?? payload.length;
}

async function syncRefundsSection(
  linked: LinkedCreatorModel[],
  startYmd: string,
  endYmd: string
): Promise<CreatorSyncSectionResult> {
  const result: CreatorSyncSectionResult = { upserted: 0, errors: [] };
  for (const link of linked) {
    try {
      const refunds = await fetchCreatorRefunds({
        creatorId: link.creatorInflowwId,
        startYmd,
        endYmd,
      });
      result.upserted += await upsertRefunds(link, refunds);
    } catch (err) {
      logInflowwFailure("syncRefundsSection", err, { creatorId: link.creatorInflowwId });
      result.errors.push({
        creatorId: link.creatorInflowwId,
        message: err instanceof Error ? err.message : String(err),
        status: err instanceof InflowwApiError ? err.status : undefined,
        path: err instanceof InflowwApiError ? err.path : undefined,
      });
    }
  }
  return result;
}

async function syncPriorityMassMessagesSection(
  linked: LinkedCreatorModel[],
  startYmd: string,
  endYmd: string
): Promise<CreatorSyncSectionResult> {
  const result: CreatorSyncSectionResult = { upserted: 0, errors: [] };
  for (const link of linked) {
    try {
      const rows = await fetchPriorityMassMessages({
        creatorId: link.creatorInflowwId,
        startYmd,
        endYmd,
      });
      result.upserted += await upsertPriorityMassMessages(link, rows);
    } catch (err) {
      logInflowwFailure("syncPriorityMassMessagesSection", err, {
        creatorId: link.creatorInflowwId,
      });
      result.errors.push({
        creatorId: link.creatorInflowwId,
        message: err instanceof Error ? err.message : String(err),
        status: err instanceof InflowwApiError ? err.status : undefined,
        path: err instanceof InflowwApiError ? err.path : undefined,
      });
    }
  }
  return result;
}

/**
 * Sync creator-level Infloww data for all matched modelss ↔ Infloww creators.
 * Defaults to today+yesterday (same window as employee cron).
 */
export async function syncInflowwCreatorEarnings(params?: {
  startYmd?: string;
  endYmd?: string;
  /** Skip marketing links/fans (useful for focused backfills). */
  skipMarketing?: boolean;
  /** Skip transactions + transaction-perf. */
  skipTransactions?: boolean;
  /** Skip creator-report daily stats (incl. renew-on). */
  skipDailyStats?: boolean;
  /** Skip refunds. */
  skipRefunds?: boolean;
  /** Skip priority mass messages. */
  skipPriorityMassMessages?: boolean;
}): Promise<CreatorEarningsSyncResult> {
  const today = inflowwReportTodayYmd();
  const defaultDay = addDaysAthensYmd(today, -1);
  let startYmd = (params?.startYmd ?? defaultDay).slice(0, 10);
  let endYmd = (params?.endYmd ?? today).slice(0, 10);
  if (startYmd > endYmd) {
    const t = startYmd;
    startYmd = endYmd;
    endYmd = t;
  }
  const earliest = addDaysAthensYmd(today, -(EMPLOYEE_REPORT_MAX_LOOKBACK_DAYS - 1));
  if (startYmd < earliest) startYmd = earliest;
  if (endYmd > today) endYmd = today;

  const { linked, unmatchedCount } = await listLinkedCreatorModels();

  const empty: CreatorSyncSectionResult = { upserted: 0, errors: [] };
  const dailyStats = params?.skipDailyStats
    ? empty
    : await syncCreatorReportSection(linked, startYmd, endYmd);
  const transactions = params?.skipTransactions
    ? empty
    : await syncTransactionsSection(linked, startYmd, endYmd);
  const marketing = params?.skipMarketing
    ? { links: empty, fans: empty }
    : await syncMarketingSection(linked);
  const refunds = params?.skipRefunds
    ? empty
    : await syncRefundsSection(linked, startYmd, endYmd);
  const priorityMassMessages = params?.skipPriorityMassMessages
    ? empty
    : await syncPriorityMassMessagesSection(linked, startYmd, endYmd);

  return {
    startYmd,
    endYmd,
    creatorsTargeted: linked.length,
    unmatchedModels: unmatchedCount,
    dailyStats,
    transactions,
    marketingLinks: marketing.links,
    linkFans: marketing.fans,
    refunds,
    priorityMassMessages,
  };
}

export type CreatorDailyStatsRow = {
  creator_infloww_id: string;
  model_record_id: string | null;
  model_stable_id: string | null;
  model_name: string | null;
  date: string;
  performance_rank: number | null;
  profile_visitors: number;
  guest_visitors: number;
  logged_in_visitors: number;
  active_fans: number;
  expired_fans: number;
  new_subscribers: number;
  renewals: number;
  messages_sent: number;
  ppvs_sent: number;
  fans_chatted: number;
  reply_time_ms: number | null;
  /** Null when Infloww omitted renew-on for this creator/day. */
  fans_with_renew_on: number | null;
};

export async function listCreatorDailyStats(params: {
  startYmd: string;
  endYmd: string;
  modelRecordId?: string;
  creatorInflowwId?: string;
}): Promise<CreatorDailyStatsRow[]> {
  const sb = getSupabaseServiceClient();
  const selectCols =
    "creator_infloww_id, model_record_id, model_stable_id, model_name, date, performance_rank, profile_visitors, guest_visitors, logged_in_visitors, active_fans, expired_fans, new_subscribers, renewals, messages_sent, ppvs_sent, fans_chatted, reply_time_ms, fans_with_renew_on";
  const out: CreatorDailyStatsRow[] = [];
  let offset = 0;

  while (true) {
    let q = sb
      .from("infloww_creator_daily_stats")
      .select(selectCols)
      .gte("date", params.startYmd)
      .lte("date", params.endYmd)
      .order("date", { ascending: true })
      .range(offset, offset + SUPABASE_PAGE_SIZE - 1);
    if (params.modelRecordId) q = q.eq("model_record_id", params.modelRecordId);
    if (params.creatorInflowwId) q = q.eq("creator_infloww_id", params.creatorInflowwId);
    const { data, error } = await q;
    if (error) throw new Error(`listCreatorDailyStats: ${error.message}`);
    const rows = data ?? [];
    for (const row of rows) {
      out.push({
        creator_infloww_id: String(row.creator_infloww_id),
        model_record_id: row.model_record_id ? String(row.model_record_id) : null,
        model_stable_id: row.model_stable_id ? String(row.model_stable_id) : null,
        model_name: row.model_name ? String(row.model_name) : null,
        date: String(row.date).slice(0, 10),
        performance_rank: row.performance_rank == null ? null : n(row.performance_rank),
        profile_visitors: Math.round(n(row.profile_visitors)),
        guest_visitors: Math.round(n(row.guest_visitors)),
        logged_in_visitors: Math.round(n(row.logged_in_visitors)),
        active_fans: Math.round(n(row.active_fans)),
        expired_fans: Math.round(n(row.expired_fans)),
        new_subscribers: Math.round(n(row.new_subscribers)),
        renewals: Math.round(n(row.renewals)),
        messages_sent: Math.round(n(row.messages_sent)),
        ppvs_sent: Math.round(n(row.ppvs_sent)),
        fans_chatted: Math.round(n(row.fans_chatted)),
        reply_time_ms: row.reply_time_ms == null ? null : n(row.reply_time_ms),
        fans_with_renew_on:
          row.fans_with_renew_on == null ? null : Math.round(n(row.fans_with_renew_on)),
      });
    }
    if (rows.length < SUPABASE_PAGE_SIZE) break;
    offset += rows.length;
  }

  return out;
}

export type CreatorTransactionRow = {
  transaction_id: string;
  infloww_row_id: string | null;
  creator_infloww_id: string;
  model_record_id: string | null;
  model_name?: string | null;
  fan_id: string | null;
  fan_name: string | null;
  created_time: string | null;
  type: string | null;
  status: string | null;
  amount: number;
  fee: number;
  net: number;
  sales_rule: string | null;
  attribute_employee_id: string | null;
  sales_amount: number | null;
};

function mapCreatorTransactionRow(row: Record<string, unknown>): CreatorTransactionRow {
  return {
    transaction_id: String(row.transaction_id),
    infloww_row_id: row.infloww_row_id ? String(row.infloww_row_id) : null,
    creator_infloww_id: String(row.creator_infloww_id),
    model_record_id: row.model_record_id ? String(row.model_record_id) : null,
    fan_id: row.fan_id ? String(row.fan_id) : null,
    fan_name: row.fan_name ? String(row.fan_name) : null,
    created_time: row.created_time ? String(row.created_time) : null,
    type: row.type ? String(row.type) : null,
    status: row.status ? String(row.status) : null,
    amount: n(row.amount),
    fee: n(row.fee),
    net: n(row.net),
    sales_rule: row.sales_rule ? String(row.sales_rule) : null,
    attribute_employee_id: row.attribute_employee_id ? String(row.attribute_employee_id) : null,
    sales_amount: row.sales_amount == null ? null : n(row.sales_amount),
  };
}

export async function listCreatorTransactions(params: {
  startYmd: string;
  endYmd: string;
  modelRecordId?: string;
  creatorInflowwId?: string;
  type?: string;
  status?: string;
  search?: string;
  limit?: number;
  /** Paginate through all matching rows (for month-wide revenue aggregation). */
  fetchAll?: boolean;
  /** When true, only revenue-countable statuses (`done` + `loading`) — for totals. Default false for transaction lists. */
  revenueOnly?: boolean;
}): Promise<CreatorTransactionRow[]> {
  const sb = getSupabaseServiceClient();
  const { startIso, endIso } = inflowwStatsRangeToCreatedTimeIso(params);
  const fetchAll = params.fetchAll === true;
  const maxRows = fetchAll ? Number.POSITIVE_INFINITY : (params.limit ?? 500);
  const selectCols =
    "transaction_id, infloww_row_id, creator_infloww_id, model_record_id, fan_id, fan_name, created_time, type, status, amount, fee, net, sales_rule, attribute_employee_id, sales_amount";

  const out: CreatorTransactionRow[] = [];
  let offset = 0;

  while (out.length < maxRows) {
    const pageSize = Math.min(
      SUPABASE_PAGE_SIZE,
      fetchAll ? SUPABASE_PAGE_SIZE : maxRows - out.length
    );
    let q = sb
      .from("infloww_transactions")
      .select(selectCols)
      .gte("created_time", startIso)
      .lte("created_time", endIso)
      .order("created_time", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (params.modelRecordId) q = q.eq("model_record_id", params.modelRecordId);
    if (params.creatorInflowwId) q = q.eq("creator_infloww_id", params.creatorInflowwId);
    if (params.type) q = q.eq("type", params.type);
    if (params.status) q = q.eq("status", params.status);
    else if (params.revenueOnly) q = q.in("status", [...CREATOR_TX_REVENUE_STATUSES]);
    if (params.search?.trim()) {
      const s = params.search.trim();
      q = q.or(`fan_name.ilike.%${s}%,fan_id.ilike.%${s}%,transaction_id.ilike.%${s}%`);
    }
    const { data, error } = await q;
    if (error) throw new Error(`listCreatorTransactions: ${error.message}`);
    const rows = data ?? [];
    for (const row of rows) {
      out.push(mapCreatorTransactionRow(row as Record<string, unknown>));
    }
    if (rows.length < pageSize) break;
    offset += rows.length;
  }

  return params.revenueOnly ? dedupeCreatorTransactionsForRevenue(out) : out;
}

export type CreatorDailyRevenueRow = {
  model_record_id: string;
  date: string;
  revenue: number;
};

/**
 * Pre-aggregated creator revenue by Athens calendar day (done + loading, deduped).
 * Prefer this over fetchAll listCreatorTransactions when only daily totals are needed.
 */
export async function listCreatorRevenueByAthensDay(params: {
  startYmd: string;
  endYmd: string;
  modelRecordId?: string;
}): Promise<CreatorDailyRevenueRow[]> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.rpc("infloww_creator_revenue_by_athens_day", {
    p_start_ymd: params.startYmd,
    p_end_ymd: params.endYmd,
  });
  if (error) throw new Error(`listCreatorRevenueByAthensDay: ${error.message}`);
  const rows = (data ?? []) as Array<{
    model_record_id: string | null;
    day: string;
    revenue: number | string | null;
  }>;
  const out: CreatorDailyRevenueRow[] = [];
  for (const row of rows) {
    const modelId = row.model_record_id ? String(row.model_record_id) : "";
    if (!modelId) continue;
    if (params.modelRecordId && modelId !== params.modelRecordId) continue;
    out.push({
      model_record_id: modelId,
      date: String(row.day).slice(0, 10),
      revenue: n(row.revenue),
    });
  }
  return out;
}

/** Expand daily revenue aggregates into synthetic tx rows for helpers that expect CreatorTransactionRow. */
export function syntheticCreatorTxFromDailyRevenue(
  rows: CreatorDailyRevenueRow[]
): CreatorTransactionRow[] {
  return rows.map((r) => ({
    transaction_id: `daily-agg:${r.model_record_id}:${r.date}`,
    infloww_row_id: null,
    creator_infloww_id: "",
    model_record_id: r.model_record_id,
    fan_id: null,
    fan_name: null,
    created_time: `${r.date}T12:00:00+03:00`,
    type: "aggregate",
    status: "done",
    amount: r.revenue,
    fee: 0,
    net: r.revenue,
    sales_rule: null,
    attribute_employee_id: null,
    sales_amount: null,
  }));
}

export type CreatorModelRevenueRanking = {
  rank: number;
  model_record_id: string;
  model_name: string;
  creator_infloww_id: string | null;
  /** Post-OF creator share — same formula as creatorTxRevenueAmount / Athens-day RPC. */
  revenue: number;
};

/**
 * Rank linked models by Creator Earnings revenue for an Athens YMD range.
 * Single source of truth with Admin Home / Creator Earnings: Athens-day RPC
 * (done + loading, deduped hex twins) + linked model names.
 */
export async function listCreatorModelRevenueRankings(params: {
  startYmd: string;
  endYmd: string;
  modelRecordId?: string;
}): Promise<CreatorModelRevenueRanking[]> {
  const [{ linked }, dailyRevenue] = await Promise.all([
    listLinkedCreatorModels(),
    listCreatorRevenueByAthensDay({
      startYmd: params.startYmd,
      endYmd: params.endYmd,
      modelRecordId: params.modelRecordId,
    }),
  ]);

  const nameById = new Map(linked.map((l) => [l.modelRecordId, l.modelName] as const));
  const creatorById = new Map(
    linked.map((l) => [l.modelRecordId, l.creatorInflowwId] as const)
  );

  const byModel = new Map<string, number>();
  for (const row of dailyRevenue) {
    byModel.set(row.model_record_id, (byModel.get(row.model_record_id) ?? 0) + row.revenue);
  }

  return [...byModel.entries()]
    .map(([model_record_id, revenue]) => ({
      model_record_id,
      model_name: nameById.get(model_record_id)?.trim() || "—",
      creator_infloww_id: creatorById.get(model_record_id) ?? null,
      revenue: Math.round(revenue * 100) / 100,
    }))
    .filter((r) => r.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export type CreatorTransactionTypeCount = {
  type: string;
  count: number;
  gross: number;
  net: number;
};

/** Distinct transaction types + counts for filter chips (range-scoped). */
export async function listCreatorTransactionTypeCounts(params: {
  startYmd: string;
  endYmd: string;
  modelRecordId?: string;
  creatorInflowwId?: string;
  revenueOnly?: boolean;
}): Promise<CreatorTransactionTypeCount[]> {
  if (!params.modelRecordId && !params.creatorInflowwId && params.revenueOnly !== false) {
    try {
      return await listCreatorTransactionTypeCountsRpc(params);
    } catch (err) {
      console.warn("[infloww] listCreatorTransactionTypeCounts RPC failed — falling back", err);
    }
  }

  const [txs, refunds] = await Promise.all([
    listCreatorTransactions({
      startYmd: params.startYmd,
      endYmd: params.endYmd,
      modelRecordId: params.modelRecordId,
      creatorInflowwId: params.creatorInflowwId,
      fetchAll: true,
      revenueOnly: params.revenueOnly !== false,
    }),
    listCreatorRefunds({
      startYmd: params.startYmd,
      endYmd: params.endYmd,
      modelRecordId: params.modelRecordId,
      creatorInflowwId: params.creatorInflowwId,
      limit: 5000,
    }),
  ]);
  const refundByTxId = refundsByTransactionId(refunds);
  const map = new Map<string, { count: number; gross: number; net: number }>();
  for (const row of txs) {
    const type = (row.type ?? "unknown").trim() || "unknown";
    const prev = map.get(type) ?? { count: 0, gross: 0, net: 0 };
    const gross = creatorTxGrossAmount(row);
    prev.count += 1;
    prev.gross += gross;
    prev.net += creatorTxNetAfterRefunds(row, refundByTxId);
    map.set(type, prev);
  }
  return [...map.entries()]
    .map(([type, v]) => ({ type, ...v }))
    .sort((a, b) => b.count - a.count);
}

/** SQL aggregate — avoids paginating every transaction row (Admin Home, dashboards). */
async function listCreatorTransactionTypeCountsRpc(params: {
  startYmd: string;
  endYmd: string;
}): Promise<CreatorTransactionTypeCount[]> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.rpc("infloww_creator_tx_type_counts", {
    p_start_ymd: params.startYmd,
    p_end_ymd: params.endYmd,
  });
  if (error) throw new Error(`listCreatorTransactionTypeCountsRpc: ${error.message}`);
  return ((data ?? []) as Array<{
    type: string | null;
    count: number | string | null;
    gross: number | string | null;
    net: number | string | null;
  }>).map((row) => ({
    type: (row.type ?? "unknown").trim() || "unknown",
    count: n(row.count),
    gross: n(row.gross),
    net: n(row.net),
  }));
}

export type MarketingLinkRow = {
  id: string;
  model_id: string;
  creator_infloww_id: string;
  infloww_link_id: string;
  link_type: string;
  message: string | null;
  sub_count: number;
  paying_fans_count: number;
  earnings_gross: number;
  earnings_net: number;
  finished_flag: boolean;
  link_created_time: string | null;
  expired_time: string | null;
};

export async function listMarketingLinks(params: {
  modelRecordId?: string;
  creatorInflowwId?: string;
  linkType?: string;
  /** Exclude these link types (e.g. model view hides CAMPAIGN). */
  excludeLinkTypes?: string[];
}): Promise<MarketingLinkRow[]> {
  const sb = getSupabaseServiceClient();
  let q = sb
    .from("infloww_marketing_links")
    .select(
      "id, model_id, creator_infloww_id, infloww_link_id, link_type, message, sub_count, paying_fans_count, earnings_gross, earnings_net, finished_flag, link_created_time, expired_time"
    )
    .order("earnings_gross", { ascending: false })
    .limit(500);
  if (params.modelRecordId) q = q.eq("model_id", params.modelRecordId);
  if (params.creatorInflowwId) q = q.eq("creator_infloww_id", params.creatorInflowwId);
  if (params.linkType) q = q.eq("link_type", params.linkType);
  if (params.excludeLinkTypes?.length) {
    for (const t of params.excludeLinkTypes) {
      q = q.neq("link_type", t);
    }
  }
  const { data, error } = await q;
  if (error) throw new Error(`listMarketingLinks: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    model_id: String(row.model_id),
    creator_infloww_id: String(row.creator_infloww_id),
    infloww_link_id: String(row.infloww_link_id),
    link_type: String(row.link_type),
    message: row.message ? String(row.message) : null,
    sub_count: Math.round(n(row.sub_count)),
    paying_fans_count: Math.round(n(row.paying_fans_count)),
    earnings_gross: n(row.earnings_gross),
    earnings_net: n(row.earnings_net),
    finished_flag: row.finished_flag === true,
    link_created_time: row.link_created_time ? String(row.link_created_time) : null,
    expired_time: row.expired_time ? String(row.expired_time) : null,
  }));
}

/**
 * Cross-check transaction-perf attributed sales vs employee-report sales by day.
 * Compares sum(sales_amount) for attribute_employee_id per Athens day against
 * sum(infloww_daily_stats.sales) for the matching infloww_employee_id.
 */
export async function compareTransactionPerfVsEmployeeSales(params: {
  startYmd: string;
  endYmd: string;
  modelRecordId?: string;
}): Promise<
  Array<{
    date: string;
    infloww_employee_id: string;
    perf_sales: number;
    employee_report_sales: number;
    delta: number;
  }>
> {
  const sb = getSupabaseServiceClient();
  const { startIso, endIso } = inflowwStatsRangeToCreatedTimeIso(params);
  let txQ = sb
    .from("infloww_transactions")
    .select("created_time, attribute_employee_id, sales_amount")
    .gte("created_time", startIso)
    .lte("created_time", endIso)
    .in("status", [...CREATOR_TX_REVENUE_STATUSES])
    .not("attribute_employee_id", "is", null);
  if (params.modelRecordId) txQ = txQ.eq("model_record_id", params.modelRecordId);
  const { data: txs, error: txErr } = await txQ;
  if (txErr) throw new Error(`compare tx: ${txErr.message}`);

  const perfByKey = new Map<string, number>();
  for (const row of txs ?? []) {
    const emp = String(row.attribute_employee_id ?? "").trim();
    if (!emp) continue;
    const ms = row.created_time ? Date.parse(String(row.created_time)) : NaN;
    if (!Number.isFinite(ms)) continue;
    const date = new Date(ms).toISOString().slice(0, 10);
    const k = `${emp}|${date}`;
    perfByKey.set(k, (perfByKey.get(k) ?? 0) + n(row.sales_amount));
  }

  const empIds = [
    ...new Set([...perfByKey.keys()].map((k) => k.split("|")[0]!).filter(Boolean)),
  ];
  if (!empIds.length) return [];

  // infloww_employee_id is bigint; attribute ids from Infloww are large numeric strings
  const { data: stats, error: stErr } = await sb
    .from("infloww_daily_stats")
    .select("infloww_employee_id, date, sales")
    .gte("date", params.startYmd)
    .lte("date", params.endYmd);
  if (stErr) throw new Error(`compare employee stats: ${stErr.message}`);

  const empByKey = new Map<string, number>();
  for (const row of stats ?? []) {
    const emp = String(row.infloww_employee_id);
    const date = String(row.date).slice(0, 10);
    const k = `${emp}|${date}`;
    empByKey.set(k, (empByKey.get(k) ?? 0) + n(row.sales));
  }

  const out: Array<{
    date: string;
    infloww_employee_id: string;
    perf_sales: number;
    employee_report_sales: number;
    delta: number;
  }> = [];
  const keys = new Set([...perfByKey.keys(), ...empByKey.keys()]);
  for (const k of keys) {
    const [emp, date] = k.split("|");
    if (!emp || !date) continue;
    if (empIds.length && !empIds.includes(emp) && !perfByKey.has(k)) continue;
    const perf = perfByKey.get(k) ?? 0;
    const empSales = empByKey.get(k) ?? 0;
    const delta = perf - empSales;
    if (Math.abs(delta) < 0.01 && perf === 0 && empSales === 0) continue;
    out.push({
      date,
      infloww_employee_id: emp,
      perf_sales: perf,
      employee_report_sales: empSales,
      delta,
    });
  }
  return out
    .filter((r) => Math.abs(r.delta) >= 0.5)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export type CreatorRefundRow = {
  refund_id: string;
  transaction_id: string;
  creator_infloww_id: string;
  model_record_id: string | null;
  fan_id: string | null;
  payment_amount: number;
  transaction_type: string | null;
  payment_status: string | null;
  refund_time: string | null;
  payment_time: string | null;
};

export async function listCreatorRefunds(params: {
  startYmd: string;
  endYmd: string;
  modelRecordId?: string;
  creatorInflowwId?: string;
  limit?: number;
}): Promise<CreatorRefundRow[]> {
  const sb = getSupabaseServiceClient();
  const { startIso, endIso } = inflowwStatsRangeToCreatedTimeIso(params);
  let q = sb
    .from("infloww_refunds")
    .select(
      "refund_id, transaction_id, creator_infloww_id, model_record_id, fan_id, payment_amount, transaction_type, payment_status, refund_time, payment_time"
    )
    .gte("refund_time", startIso)
    .lte("refund_time", endIso)
    .order("refund_time", { ascending: false })
    .limit(params.limit ?? 500);
  if (params.modelRecordId) q = q.eq("model_record_id", params.modelRecordId);
  if (params.creatorInflowwId) q = q.eq("creator_infloww_id", params.creatorInflowwId);
  const { data, error } = await q;
  if (error) throw new Error(`listCreatorRefunds: ${error.message}`);
  return (data ?? []).map((row) => ({
    refund_id: String(row.refund_id),
    transaction_id: String(row.transaction_id),
    creator_infloww_id: String(row.creator_infloww_id),
    model_record_id: row.model_record_id ? String(row.model_record_id) : null,
    fan_id: row.fan_id ? String(row.fan_id) : null,
    payment_amount: n(row.payment_amount),
    transaction_type: row.transaction_type ? String(row.transaction_type) : null,
    payment_status: row.payment_status ? String(row.payment_status) : null,
    refund_time: row.refund_time ? String(row.refund_time) : null,
    payment_time: row.payment_time ? String(row.payment_time) : null,
  }));
}

export type PriorityMassMessageRow = {
  priority_mass_message_id: string;
  creator_infloww_id: string;
  model_record_id: string | null;
  employee_id: string | null;
  status: string | null;
  price: number;
  revenue: number;
  number_of_times_sent: number;
  number_of_purchases: number;
  message_preview: string | null;
  sent_time: string | null;
  created_time: string | null;
};

export async function listPriorityMassMessages(params: {
  startYmd?: string;
  endYmd?: string;
  modelRecordId?: string;
  creatorInflowwId?: string;
  employeeId?: string;
  limit?: number;
}): Promise<PriorityMassMessageRow[]> {
  const sb = getSupabaseServiceClient();
  let q = sb
    .from("infloww_priority_mass_messages")
    .select(
      "priority_mass_message_id, creator_infloww_id, model_record_id, employee_id, status, price, revenue, number_of_times_sent, number_of_purchases, message_preview, sent_time, created_time"
    )
    .order("sent_time", { ascending: false, nullsFirst: false })
    .limit(params.limit ?? 500);
  if (params.modelRecordId) q = q.eq("model_record_id", params.modelRecordId);
  if (params.creatorInflowwId) q = q.eq("creator_infloww_id", params.creatorInflowwId);
  if (params.employeeId) q = q.eq("employee_id", params.employeeId);
  if (params.startYmd && params.endYmd) {
    const { startIso, endIso } = inflowwStatsRangeToCreatedTimeIso({
      startYmd: params.startYmd,
      endYmd: params.endYmd,
    });
    q = q.gte("sent_time", startIso).lte("sent_time", endIso);
  } else if (params.startYmd) {
    q = q.gte("sent_time", inflowwStatsRangeToCreatedTimeIso({
      startYmd: params.startYmd,
      endYmd: params.startYmd,
    }).startIso);
  } else if (params.endYmd) {
    q = q.lte("sent_time", inflowwStatsRangeToCreatedTimeIso({
      startYmd: params.endYmd,
      endYmd: params.endYmd,
    }).endIso);
  }
  const { data, error } = await q;
  if (error) throw new Error(`listPriorityMassMessages: ${error.message}`);
  return (data ?? []).map((row) => ({
    priority_mass_message_id: String(row.priority_mass_message_id),
    creator_infloww_id: String(row.creator_infloww_id),
    model_record_id: row.model_record_id ? String(row.model_record_id) : null,
    employee_id: row.employee_id ? String(row.employee_id) : null,
    status: row.status ? String(row.status) : null,
    price: n(row.price),
    revenue: n(row.revenue),
    number_of_times_sent: Math.round(n(row.number_of_times_sent)),
    number_of_purchases: Math.round(n(row.number_of_purchases)),
    message_preview: row.message_preview ? String(row.message_preview) : null,
    sent_time: row.sent_time ? String(row.sent_time) : null,
    created_time: row.created_time ? String(row.created_time) : null,
  }));
}
