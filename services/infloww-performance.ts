/**
 * Aggregate Infloww daily stats for chatter/admin performance views.
 */

import { addDaysAthensYmd, getTodayYmdAthens } from "@/lib/airtable-datetime";
import {
  getUserInflowwLinkByPublicId,
  listUsersWithInflowwEmployeeId,
  queryInflowwDailyStats,
  type InflowwDailyStatsRow,
  type LinkedInflowwUser,
} from "@/services/infloww-daily-stats";

export type InflowwStatsPreset = "this_week" | "last_week" | "this_month" | "custom";

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
};

export type InflowwAdminPerformanceReport = {
  range: InflowwStatsRange;
  team_totals: InflowwMetricTotals;
  chatters: InflowwChatterPerformance[];
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

function monthStart(ymd: string): string {
  const p = parseYmd(ymd);
  if (!p) return ymd;
  return `${p.y}-${String(p.m).padStart(2, "0")}-01`;
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
  return { startYmd: monthStart(today), endYmd: today, preset: "this_month" };
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

function buildPerformance(
  user: LinkedInflowwUser,
  range: InflowwStatsRange,
  rows: InflowwDailyStatsRow[],
  linked: boolean
): InflowwChatterPerformance {
  const totals = emptyTotals();
  const byDay = new Map<string, InflowwDailyTrendPoint>();
  const byPerf = new Map<number, InflowwPerformerBreakdown>();

  for (const row of rows) {
    addTotals(totals, row);

    let day = byDay.get(row.date);
    if (!day) {
      day = { ymd: row.date, sales: 0, messages_sent: 0, fans_chatted: 0 };
      byDay.set(row.date, day);
    }
    day.sales += row.sales;
    day.messages_sent += row.messages_sent;
    day.fans_chatted += row.fans_chatted;

    let perf = byPerf.get(row.infloww_performer_id);
    if (!perf) {
      perf = {
        performer_id: row.infloww_performer_id,
        performer_name: row.performer_name || (row.infloww_performer_id ? `Creator ${row.infloww_performer_id}` : "All / unknown"),
        totals: emptyTotals(),
      };
      byPerf.set(row.infloww_performer_id, perf);
    }
    if (row.performer_name) perf.performer_name = row.performer_name;
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
    by_performer: Array.from(byPerf.values()).sort((a, b) => b.totals.sales - a.totals.sales),
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
    };
  }
  const linked = link.infloww_employee_id > 0;
  if (!linked) {
    return buildPerformance(link, range, [], false);
  }
  const rows = await queryInflowwDailyStats({
    userUuids: [link.uuid],
    startYmd: range.startYmd,
    endYmd: range.endYmd,
  });
  return buildPerformance(link, range, rows, true);
}

export async function getAdminInflowwPerformanceReport(
  range: InflowwStatsRange,
  filters?: { publicUserId?: string; performerId?: number }
): Promise<InflowwAdminPerformanceReport> {
  let users = await listUsersWithInflowwEmployeeId();
  if (filters?.publicUserId) {
    const id = filters.publicUserId.trim();
    users = users.filter((u) => u.publicId === id || u.uuid === id);
  }

  const uuids = users.map((u) => u.uuid);
  const rows = uuids.length
    ? await queryInflowwDailyStats({
        userUuids: uuids,
        startYmd: range.startYmd,
        endYmd: range.endYmd,
        performerId: filters?.performerId,
      })
    : [];

  const byUser = new Map<string, InflowwDailyStatsRow[]>();
  for (const row of rows) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  const chatters = users.map((u) =>
    buildPerformance(u, range, byUser.get(u.uuid) ?? [], true)
  );
  chatters.sort((a, b) => b.totals.sales - a.totals.sales);

  const team_totals = emptyTotals();
  for (const c of chatters) {
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

  return { range, team_totals, chatters };
}
