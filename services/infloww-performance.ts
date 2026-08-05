/**
 * Aggregate Infloww daily stats for chatter/admin performance views.
 * Derived metrics live in `services/infloww-analytics.ts`.
 */

import { addDaysAthensYmd, getTodayYmdAthens } from "@/lib/airtable-datetime";
import { getInflowwModels } from "@/lib/infloww-api";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { publicId } from "@/lib/supabase-data";
import { listAllShifts } from "@/services/shifts";
import {
  buildChatterAlerts,
  buildHeatmapCells,
  computeRebillSalesCorrelation,
  deriveChatterAnalytics,
  previousPeriodRange,
  type ChatterCreatorHeatCell,
  type DerivedChatterAnalytics,
  type PerformanceAlert,
  type RebillRetentionNote,
  type WhaleCandidateSuggestion,
} from "@/services/infloww-analytics";
import {
  getUserInflowwLinkByPublicId,
  listUsersWithInflowwEmployeeId,
  queryInflowwDailyStats,
  type InflowwDailyStatsRow,
  type LinkedInflowwUser,
} from "@/services/infloww-daily-stats";
import type { Shift } from "@/types";

/** Bucket label when Infloww collapses rows with no performer attribution. */
export const UNATTRIBUTED_PERFORMER_LABEL = "Unattributed";

export type InflowwStatsPreset =
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "custom";

export type InflowwStatsRange = {
  startYmd: string;
  endYmd: string;
  preset: InflowwStatsPreset;
};

export type InflowwMetricTotals = {
  sales: number;
  ppv_sales: number;
  tips: number;
  dm_sales: number;
  pmm_sales: number;
  ofmm_sales: number;
  messages_sent: number;
  ppvs_sent: number;
  fans_chatted: number;
  fans_who_spent: number;
  golden_ratio: number | null;
  fan_cvr: number | null;
};

export type InflowwDailyTrendPoint = {
  ymd: string;
  sales: number;
  messages_sent: number;
  fans_chatted: number;
  ppvs_sent: number;
};

export type InflowwPerformerBreakdown = {
  performer_id: number;
  performer_name: string;
  totals: InflowwMetricTotals;
};

export type InflowwChatterPerformance = {
  user_public_id: string;
  user_uuid: string;
  full_name: string;
  infloww_employee_id: number;
  linked: boolean;
  range: InflowwStatsRange;
  totals: InflowwMetricTotals;
  daily: InflowwDailyTrendPoint[];
  by_performer: InflowwPerformerBreakdown[];
  analytics: DerivedChatterAnalytics | null;
};

export type InflowwAdminPerformanceReport = {
  range: InflowwStatsRange;
  team_totals: InflowwMetricTotals;
  chatters: InflowwChatterPerformance[];
  alerts: PerformanceAlert[];
  heatmap: ChatterCreatorHeatCell[];
  rebill_retention: RebillRetentionNote;
  whale_suggestions: WhaleCandidateSuggestion[];
  /** Sensitive ROI rows — only populated when caller requests includeRoi. */
  include_roi: boolean;
};

function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  const parts = ymd.trim().slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some((x) => !Number.isFinite(x))) return null;
  return { y: parts[0]!, m: parts[1]!, d: parts[2]! };
}

function startOfWeekMonday(ymd: string): string {
  const p = parseYmd(ymd);
  if (!p) return ymd;
  const mid = new Date(Date.UTC(p.y, p.m - 1, p.d, 12, 0, 0));
  const dow = mid.getUTCDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  mid.setUTCDate(mid.getUTCDate() + delta);
  return mid.toISOString().slice(0, 10);
}

function monthBounds(ymd: string): { start: string; end: string } {
  const p = parseYmd(ymd);
  if (!p) return { start: ymd, end: ymd };
  const start = `${p.y}-${String(p.m).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(p.y, p.m, 0, 12, 0, 0));
  const end = last.toISOString().slice(0, 10);
  return { start, end };
}

export function resolveInflowwStatsRange(
  preset: InflowwStatsPreset,
  customStart?: string | null,
  customEnd?: string | null
): InflowwStatsRange {
  const today = getTodayYmdAthens();
  if (preset === "custom") {
    const start = (customStart ?? today).slice(0, 10);
    const end = (customEnd ?? today).slice(0, 10);
    return start <= end
      ? { startYmd: start, endYmd: end, preset }
      : { startYmd: end, endYmd: start, preset };
  }
  if (preset === "this_week") {
    return { startYmd: startOfWeekMonday(today), endYmd: today, preset };
  }
  if (preset === "last_week") {
    const thisMon = startOfWeekMonday(today);
    const lastSun = addDaysAthensYmd(thisMon, -1);
    const lastMon = startOfWeekMonday(lastSun);
    return { startYmd: lastMon, endYmd: lastSun, preset };
  }
  if (preset === "this_month") {
    const { start } = monthBounds(today);
    return { startYmd: start, endYmd: today, preset };
  }
  if (preset === "last_month") {
    const p = parseYmd(today)!;
    const prevMonthAnchor = addDaysAthensYmd(`${p.y}-${String(p.m).padStart(2, "0")}-01`, -1);
    const { start, end } = monthBounds(prevMonthAnchor);
    return { startYmd: start, endYmd: end, preset };
  }
  return { startYmd: monthBounds(today).start, endYmd: today, preset: "this_month" };
}

function emptyTotals(): InflowwMetricTotals {
  return {
    sales: 0,
    ppv_sales: 0,
    tips: 0,
    dm_sales: 0,
    pmm_sales: 0,
    ofmm_sales: 0,
    messages_sent: 0,
    ppvs_sent: 0,
    fans_chatted: 0,
    fans_who_spent: 0,
    golden_ratio: null,
    fan_cvr: null,
  };
}

function addTotals(a: InflowwMetricTotals, row: InflowwDailyStatsRow): void {
  a.sales += row.sales;
  a.ppv_sales += row.ppv_sales;
  a.tips += row.tips;
  a.dm_sales += row.dm_sales;
  a.pmm_sales += row.pmm_sales;
  a.ofmm_sales += row.ofmm_sales;
  a.messages_sent += row.messages_sent;
  a.ppvs_sent += row.ppvs_sent;
  a.fans_chatted += row.fans_chatted;
  a.fans_who_spent += row.fans_who_spent;
}

function finalizeDerived(t: InflowwMetricTotals): void {
  t.golden_ratio = t.messages_sent > 0 ? t.ppvs_sent / t.messages_sent : null;
  t.fan_cvr = t.fans_chatted > 0 ? t.fans_who_spent / t.fans_chatted : null;
}

function sumTotals(rows: InflowwDailyStatsRow[]): InflowwMetricTotals {
  const t = emptyTotals();
  for (const row of rows) addTotals(t, row);
  finalizeDerived(t);
  return t;
}

function workedHours(s: Shift): number {
  if (typeof s.worked_minutes === "number" && s.worked_minutes > 0) return s.worked_minutes / 60;
  if (typeof s.total_minutes === "number" && s.total_minutes > 0) return s.total_minutes / 60;
  if (typeof s.total_hours_decimal === "number" && s.total_hours_decimal > 0) {
    return s.total_hours_decimal;
  }
  if (s.start_time && s.end_time) {
    const a = new Date(s.start_time).getTime();
    const b = new Date(s.end_time).getTime();
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) return (b - a) / 3_600_000;
  }
  return 0;
}

async function shiftHoursByPublicId(
  startYmd: string,
  endYmd: string,
  publicIds: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!publicIds.length) return out;
  const want = new Set(publicIds);
  const formula = `AND(DATESTR({date}) >= "${startYmd}", DATESTR({date}) <= "${endYmd}")`;
  let shifts: Shift[] = [];
  try {
    shifts = await listAllShifts(formula, "infloww-performance.shiftHours");
  } catch {
    return out;
  }
  for (const s of shifts) {
    const cid = (s.chatter_id ?? "").trim();
    if (!cid || !want.has(cid)) continue;
    if (s.status !== "completed" && s.status !== "active" && s.status !== "on_break") continue;
    if (s.staff_role && s.staff_role !== "chatter") continue;
    out.set(cid, (out.get(cid) ?? 0) + workedHours(s));
  }
  return out;
}

type CompRow = {
  compensation_type: string | null;
  compensation_value: number | null;
};

async function compensationByUuid(uuids: string[]): Promise<Map<string, CompRow>> {
  const out = new Map<string, CompRow>();
  if (!uuids.length) return out;
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("users")
    .select("id, compensation_type, compensation_value")
    .in("id", uuids);
  if (error || !data) return out;
  for (const row of data) {
    out.set(String(row.id), {
      compensation_type:
        typeof row.compensation_type === "string" ? row.compensation_type : null,
      compensation_value:
        typeof row.compensation_value === "number" ? row.compensation_value : null,
    });
  }
  return out;
}

async function rebillCountsByPublicId(
  startYmd: string,
  endYmd: string
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("rebills")
    .select("chatter_id, status, date_time, created_at")
    .gte("date_time", `${startYmd}T00:00:00`)
    .lte("date_time", `${endYmd}T23:59:59`);
  if (error || !data) {
    // Fallback: try created_at window if date_time filter fails empty
    const fallback = await sb
      .from("rebills")
      .select("chatter_id, status, created_at")
      .gte("created_at", `${startYmd}T00:00:00Z`)
      .lte("created_at", `${endYmd}T23:59:59Z`);
    if (fallback.error || !fallback.data) return out;
    for (const row of fallback.data) {
      const id = String(row.chatter_id ?? "").trim();
      if (!id) continue;
      if (row.status && String(row.status).toLowerCase() === "rejected") continue;
      out.set(id, (out.get(id) ?? 0) + 1);
    }
    return out;
  }
  for (const row of data) {
    const id = String(row.chatter_id ?? "").trim();
    if (!id) continue;
    if (row.status && String(row.status).toLowerCase() === "rejected") continue;
    out.set(id, (out.get(id) ?? 0) + 1);
  }
  return out;
}

/**
 * Whale candidates from high-value rebills whose sub username isn't already a whale.
 * Infloww daily stats lack fan-level IDs — auto-flag from Infloww alone is deferred.
 */
async function whaleSuggestionsFromRebills(params: {
  startYmd: string;
  endYmd: string;
  chatterPublicIds?: string[];
  limit?: number;
}): Promise<WhaleCandidateSuggestion[]> {
  const sb = getSupabaseServiceClient();
  const minPrice = 50;
  const { data: rebills, error } = await sb
    .from("rebills")
    .select("id, sub_username, sub_name, price, chatter_id, chatter_name, model_name, date_time, status")
    .gte("price", minPrice)
    .gte("date_time", `${params.startYmd}T00:00:00`)
    .lte("date_time", `${params.endYmd}T23:59:59`)
    .order("price", { ascending: false })
    .limit(80);

  if (error || !rebills?.length) return [];

  const { data: whales } = await sb.from("whales").select("username").limit(5000);
  const whaleSet = new Set(
    (whales ?? [])
      .map((w) => String(w.username ?? "").trim().toLowerCase())
      .filter(Boolean)
  );

  const want = params.chatterPublicIds?.length
    ? new Set(params.chatterPublicIds)
    : null;

  const seen = new Set<string>();
  const out: WhaleCandidateSuggestion[] = [];
  for (const r of rebills) {
    if (r.status && String(r.status).toLowerCase() === "rejected") continue;
    const chatterId = String(r.chatter_id ?? "").trim();
    if (want && chatterId && !want.has(chatterId)) continue;
    const username = String(r.sub_username || r.sub_name || "").trim();
    if (!username) continue;
    const key = username.toLowerCase();
    if (whaleSet.has(key) || seen.has(key)) continue;
    seen.add(key);
    const price = typeof r.price === "number" ? r.price : Number(r.price) || 0;
    out.push({
      id: `rebill-${r.id}`,
      label: username,
      reason: `High-value rebill ($${price.toFixed(0)}) not yet in Whales${
        r.model_name ? ` · ${r.model_name}` : ""
      }`,
      estimated_spend: price,
      performer_name: typeof r.model_name === "string" ? r.model_name : null,
      performer_id: null,
      suggested_username: username,
      source: "rebill_crossref",
      chatter_public_id: chatterId || null,
      chatter_name: typeof r.chatter_name === "string" ? r.chatter_name : null,
    });
    if (out.length >= (params.limit ?? 12)) break;
  }
  return out;
}

/**
 * Resolve display names for Infloww performer ids (platformPid).
 * Prefer `modelss.model_name` when `modelss.model_id` matches the Infloww creator id
 * (or equals the performer id / of_user_id); else Infloww `/creators` name; else null.
 */
async function loadPerformerDisplayNameMap(): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const modelssByKey = new Map<string, string>();

  try {
    const sb = getSupabaseServiceClient();
    const { data } = await sb.from("modelss").select("model_id, of_user_id, model_name");
    for (const row of data ?? []) {
      const name = typeof row.model_name === "string" ? row.model_name.trim() : "";
      if (!name) continue;
      const mid = typeof row.model_id === "string" ? row.model_id.trim() : "";
      if (mid) {
        modelssByKey.set(mid, name);
        const asNum = Number(mid);
        if (Number.isFinite(asNum) && asNum > 0) out.set(asNum, name);
      }
      const ofid = typeof row.of_user_id === "string" ? row.of_user_id.trim() : "";
      if (ofid) {
        modelssByKey.set(ofid, name);
        const asNum = Number(ofid);
        if (Number.isFinite(asNum) && asNum > 0) out.set(asNum, name);
      }
    }
  } catch {
    /* modelss lookup best-effort */
  }

  try {
    const creators = await getInflowwModels();
    for (const c of creators) {
      const pidRaw = c.platformPid?.trim();
      if (!pidRaw) continue;
      const pid = Number(pidRaw);
      if (!Number.isFinite(pid) || pid <= 0) continue;
      const fromModelss = modelssByKey.get(c.id) || modelssByKey.get(pidRaw);
      out.set(pid, fromModelss || c.name);
    }
  } catch {
    /* Infloww creators best-effort — modelss direct joins may still apply */
  }

  return out;
}

function performerDisplayName(
  performerId: number,
  rowName: string | null | undefined,
  nameMap: Map<number, string>
): string {
  if (!performerId) return UNATTRIBUTED_PERFORMER_LABEL;
  const mapped = nameMap.get(performerId);
  if (mapped) return mapped;
  if (rowName?.trim()) return rowName.trim();
  return `Creator ${performerId}`;
}

function sortByPerformer(rows: InflowwPerformerBreakdown[]): InflowwPerformerBreakdown[] {
  return [...rows].sort((a, b) => {
    const aUn = !a.performer_id;
    const bUn = !b.performer_id;
    if (aUn !== bUn) return aUn ? 1 : -1; // Unattributed always last
    return b.totals.sales - a.totals.sales;
  });
}

function buildPerformanceBase(
  user: LinkedInflowwUser,
  range: InflowwStatsRange,
  rows: InflowwDailyStatsRow[],
  linked: boolean,
  performerNames: Map<number, string> = new Map()
): Omit<InflowwChatterPerformance, "analytics"> {
  const totals = emptyTotals();
  const byDay = new Map<string, InflowwDailyTrendPoint>();
  const byPerf = new Map<number, InflowwPerformerBreakdown>();

  for (const row of rows) {
    addTotals(totals, row);

    let day = byDay.get(row.date);
    if (!day) {
      day = { ymd: row.date, sales: 0, messages_sent: 0, fans_chatted: 0, ppvs_sent: 0 };
      byDay.set(row.date, day);
    }
    day.sales += row.sales;
    day.messages_sent += row.messages_sent;
    day.fans_chatted += row.fans_chatted;
    day.ppvs_sent += row.ppvs_sent;

    let perf = byPerf.get(row.infloww_performer_id);
    if (!perf) {
      perf = {
        performer_id: row.infloww_performer_id,
        performer_name: performerDisplayName(
          row.infloww_performer_id,
          row.performer_name,
          performerNames
        ),
        totals: emptyTotals(),
      };
      byPerf.set(row.infloww_performer_id, perf);
    }
    // Prefer resolved map / synced name over stale fallback
    perf.performer_name = performerDisplayName(
      row.infloww_performer_id,
      row.performer_name,
      performerNames
    );
    addTotals(perf.totals, row);
  }

  finalizeDerived(totals);
  for (const p of byPerf.values()) finalizeDerived(p.totals);

  return {
    user_public_id: user.publicId,
    user_uuid: user.uuid,
    full_name: user.full_name,
    infloww_employee_id: user.infloww_employee_id,
    linked,
    range,
    totals,
    daily: Array.from(byDay.values()).sort((a, b) => a.ymd.localeCompare(b.ymd)),
    by_performer: sortByPerformer(Array.from(byPerf.values())),
  };
}

async function enrichWithAnalytics(params: {
  bases: Array<Omit<InflowwChatterPerformance, "analytics"> & { _rows: InflowwDailyStatsRow[] }>;
  range: InflowwStatsRange;
  includeRoi: boolean;
  scopeWhaleToUsers?: boolean;
}): Promise<{
  chatters: InflowwChatterPerformance[];
  alerts: PerformanceAlert[];
  heatmap: ChatterCreatorHeatCell[];
  rebill_retention: RebillRetentionNote;
  whale_suggestions: WhaleCandidateSuggestion[];
}> {
  const { bases, range, includeRoi } = params;
  const prevRange = previousPeriodRange(range.startYmd, range.endYmd);
  const uuids = bases.map((b) => b.user_uuid).filter(Boolean);
  const publicIds = bases.map((b) => b.user_public_id).filter(Boolean);

  const [prevRows, allTimeRows, hoursMap, compMap, rebillMap, whaleSuggestions] =
    await Promise.all([
      uuids.length
        ? queryInflowwDailyStats({
            userUuids: uuids,
            startYmd: prevRange.startYmd,
            endYmd: prevRange.endYmd,
          })
        : Promise.resolve([] as InflowwDailyStatsRow[]),
      uuids.length
        ? queryInflowwDailyStats({
            userUuids: uuids,
            startYmd: "2020-01-01",
            endYmd: range.endYmd,
          })
        : Promise.resolve([] as InflowwDailyStatsRow[]),
      shiftHoursByPublicId(range.startYmd, range.endYmd, publicIds),
      includeRoi ? compensationByUuid(uuids) : Promise.resolve(new Map<string, CompRow>()),
      rebillCountsByPublicId(range.startYmd, range.endYmd),
      whaleSuggestionsFromRebills({
        startYmd: range.startYmd,
        endYmd: range.endYmd,
        chatterPublicIds: params.scopeWhaleToUsers ? publicIds : undefined,
      }),
    ]);

  const prevByUser = new Map<string, InflowwDailyStatsRow[]>();
  for (const row of prevRows) {
    const list = prevByUser.get(row.user_id) ?? [];
    list.push(row);
    prevByUser.set(row.user_id, list);
  }
  const allTimeByUser = new Map<string, InflowwDailyStatsRow[]>();
  for (const row of allTimeRows) {
    const list = allTimeByUser.get(row.user_id) ?? [];
    list.push(row);
    allTimeByUser.set(row.user_id, list);
  }

  const teamSales = bases.map((b) => b.totals.sales);
  const teamSalesPerMsg = bases
    .filter((b) => b.totals.messages_sent > 0)
    .map((b) => b.totals.sales / b.totals.messages_sent);

  const rebill_retention = computeRebillSalesCorrelation(
    bases.map((b) => ({
      rebills: rebillMap.get(b.user_public_id) ?? 0,
      sales: b.totals.sales,
    }))
  );

  const chatters: InflowwChatterPerformance[] = bases.map((base) => {
    const { _rows, ...rest } = base;
    const prev = sumTotals(prevByUser.get(base.user_uuid) ?? []);
    const mine = whaleSuggestions.filter(
      (s) => !s.chatter_public_id || s.chatter_public_id === base.user_public_id
    );
    const analytics = deriveChatterAnalytics({
      totals: base.totals,
      rows: _rows,
      previousTotals: prev,
      shiftHours: hoursMap.get(base.user_public_id) ?? 0,
      allTimeRows: allTimeByUser.get(base.user_uuid) ?? _rows,
      teamSales,
      teamSalesPerMsg,
      whaleSuggestions: mine,
      rebillRetention: rebill_retention,
      compensation: compMap.get(base.user_uuid) ?? null,
      includeRoi,
      topCreatorName:
        base.by_performer.find((p) => p.performer_id > 0 && p.totals.sales > 0)
          ?.performer_name ?? null,
    });

    return { ...rest, analytics };
  });

  const alerts: PerformanceAlert[] = [];
  for (const c of chatters) {
    if (!c.analytics) continue;
    alerts.push(
      ...buildChatterAlerts({
        user_public_id: c.user_public_id,
        user_name: c.full_name,
        period_change: c.analytics.period_change,
        high_effort: c.analytics.high_effort_low_conversion,
        consistency_score: c.analytics.consistency_score,
      })
    );
  }

  return {
    chatters,
    alerts,
    heatmap: buildHeatmapCells(chatters),
    rebill_retention,
    whale_suggestions: whaleSuggestions,
  };
}

export async function getChatterInflowwPerformance(
  publicUserId: string,
  range: InflowwStatsRange
): Promise<InflowwChatterPerformance> {
  const link = await getUserInflowwLinkByPublicId(publicUserId);
  if (!link) {
    return {
      user_public_id: publicUserId,
      user_uuid: "",
      full_name: "",
      infloww_employee_id: 0,
      linked: false,
      range,
      totals: emptyTotals(),
      daily: [],
      by_performer: [],
      analytics: null,
    };
  }
  const linked = link.infloww_employee_id > 0;
  if (!linked) {
    const base = buildPerformanceBase(link, range, [], false);
    return { ...base, analytics: null };
  }
  const [rows, performerNames] = await Promise.all([
    queryInflowwDailyStats({
      userUuids: [link.uuid],
      startYmd: range.startYmd,
      endYmd: range.endYmd,
    }),
    loadPerformerDisplayNameMap(),
  ]);
  const base = buildPerformanceBase(link, range, rows, true, performerNames);
  const enriched = await enrichWithAnalytics({
    bases: [{ ...base, _rows: rows }],
    range,
    includeRoi: false,
    scopeWhaleToUsers: true,
  });
  return enriched.chatters[0]!;
}

export async function getAdminInflowwPerformanceReport(
  range: InflowwStatsRange,
  filters?: { publicUserId?: string; performerId?: number; includeRoi?: boolean }
): Promise<InflowwAdminPerformanceReport> {
  let users = await listUsersWithInflowwEmployeeId();
  if (filters?.publicUserId) {
    const id = filters.publicUserId.trim();
    users = users.filter((u) => u.publicId === id || u.uuid === id);
  }

  const uuids = users.map((u) => u.uuid);
  const [rows, performerNames] = await Promise.all([
    uuids.length
      ? queryInflowwDailyStats({
          userUuids: uuids,
          startYmd: range.startYmd,
          endYmd: range.endYmd,
          performerId: filters?.performerId,
        })
      : Promise.resolve([] as InflowwDailyStatsRow[]),
    loadPerformerDisplayNameMap(),
  ]);

  const byUser = new Map<string, InflowwDailyStatsRow[]>();
  for (const row of rows) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  const bases = users.map((u) => {
    const userRows = byUser.get(u.uuid) ?? [];
    return {
      ...buildPerformanceBase(u, range, userRows, true, performerNames),
      _rows: userRows,
    };
  });
  bases.sort((a, b) => b.totals.sales - a.totals.sales);

  const includeRoi = Boolean(filters?.includeRoi);
  const enriched = await enrichWithAnalytics({
    bases,
    range,
    includeRoi,
    scopeWhaleToUsers: users.length === 1,
  });

  const team_totals = emptyTotals();
  for (const c of enriched.chatters) {
    team_totals.sales += c.totals.sales;
    team_totals.ppv_sales += c.totals.ppv_sales;
    team_totals.tips += c.totals.tips;
    team_totals.dm_sales += c.totals.dm_sales;
    team_totals.pmm_sales += c.totals.pmm_sales;
    team_totals.ofmm_sales += c.totals.ofmm_sales;
    team_totals.messages_sent += c.totals.messages_sent;
    team_totals.ppvs_sent += c.totals.ppvs_sent;
    team_totals.fans_chatted += c.totals.fans_chatted;
    team_totals.fans_who_spent += c.totals.fans_who_spent;
  }
  finalizeDerived(team_totals);

  return {
    range,
    team_totals,
    chatters: enriched.chatters,
    alerts: enriched.alerts,
    heatmap: enriched.heatmap,
    rebill_retention: enriched.rebill_retention,
    include_roi: includeRoi,
    whale_suggestions: enriched.whale_suggestions,
  };
}

/** Resolve public id helper for callers that only have uuid. */
export function linkedUserPublicId(user: { id: string; airtable_id?: string | null }): string {
  return publicId({ id: user.id, airtable_id: user.airtable_id });
}
