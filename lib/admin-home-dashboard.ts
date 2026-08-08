/**
 * Pure builders for Admin Home — Infloww-synced revenue (no I/O).
 * Reuses period math from infloww-analytics; aggregation stays here so we don't
 * fork a third copy of team sales rollups.
 */

import { addDaysAthensYmd, getTodayYmdAthens } from "@/lib/airtable-datetime";
import { shiftWorkedMinutesFromActive } from "@/lib/shift-active-duration";
import { computePctChange } from "@/services/infloww-analytics";
import type { InflowwDailyStatsRow } from "@/services/infloww-daily-stats";
import type { CreatorTransactionRow } from "@/services/infloww-creator-earnings";
import type {
  CustomRequest,
  ModelLiveStreamRecord,
  Shift,
  WhaleTransaction,
} from "@/types";

export type AdminSparklineDay = { ymd: string; label: string; usd: number };

export type AdminSparklineWow = {
  sparkline7: AdminSparklineDay[];
  thisWeekUsd: number;
  prevWeekUsd: number;
  /** Percent change vs previous week; null if previous week was 0. */
  wowPercent: number | null;
};

export type AdminNamedAmount = { name: string; usd: number };

export type AdminDayAmount = { ymd: string; label: string; usd: number };

export type AdminMonthlyTargetProgress = {
  /** Sum of active chatter monthly targets for the month. */
  targetUsd: number;
  /** Team sales (employee daily stats) for the month. */
  achievedUsd: number;
  /** 0–100 capped. */
  progressPct: number;
  targetCount: number;
};

export type AdminRecentActivityKind =
  | "large_transaction"
  | "model_live"
  | "custom_request"
  | "whale_session";

export type AdminRecentActivityItem = {
  id: string;
  kind: AdminRecentActivityKind;
  title: string;
  subtitle: string;
  atIso: string;
  pending?: boolean;
  href?: string;
};

/** Compact live-shift row for Admin Home widget. */
export type AdminHomeLiveShiftRow = {
  id: string;
  name: string;
  role: "chatter" | "virtual_assistant";
  startTime: string | null;
  onBreak: boolean;
};

/** Compact VA progress row for Admin Home widget. */
export type AdminHomeVaProgressRow = {
  vaId: string;
  vaName: string;
  completedItems: number;
  totalItems: number;
  pct: number;
  status: "complete" | "partial" | "not_started";
};

export type AdminHomeVaProgressSummary = {
  overallPct: number;
  vasWithTasks: number;
  fullyComplete: number;
  partial: number;
  notStarted: number;
  completedItems: number;
  totalItems: number;
  rows: AdminHomeVaProgressRow[];
};

/**
 * Worked minutes for a completed shift — shared with VA Statistics / Shift Activity
 * via `shiftWorkedHours` (stored totals first, then pause-aware active duration;
 * rejects abandoned overnight wall-clock when totals are null).
 */
export function shiftWorkedMinutes(shift: Pick<
  Shift,
  | "start_time"
  | "end_time"
  | "break_minutes"
  | "paused_seconds"
  | "worked_minutes"
  | "total_minutes"
  | "total_hours_decimal"
  | "status"
  | "break_started_at"
>): number {
  return shiftWorkedMinutesFromActive(shift);
}

/**
 * Sum hours for a staff role in a shift list — completed shifts only,
 * matching Admin Shift Activity monthly totals.
 */
export function sumShiftHoursForRole(
  shifts: Shift[],
  staffRole: "chatter" | "virtual_assistant"
): number {
  let minutes = 0;
  for (const s of shifts) {
    if (s.staff_role !== staffRole) continue;
    if (s.status !== "completed") continue;
    if (!s.start_time || !s.end_time) continue;
    minutes += shiftWorkedMinutes(s);
  }
  return minutes / 60;
}

export function toAdminHomeLiveShiftRows(shifts: Shift[]): AdminHomeLiveShiftRow[] {
  return shifts
    .map((s) => ({
      id: s.id,
      name: (s.chatter_name ?? "").trim() || "—",
      role:
        s.staff_role === "virtual_assistant"
          ? ("virtual_assistant" as const)
          : ("chatter" as const),
      startTime: s.start_time,
      onBreak: s.status === "on_break" || Boolean(s.break_started_at),
    }))
    .sort((a, b) => {
      if (a.onBreak !== b.onBreak) return a.onBreak ? 1 : -1;
      const ta = a.startTime ? Date.parse(a.startTime) : 0;
      const tb = b.startTime ? Date.parse(b.startTime) : 0;
      return ta - tb;
    });
}

/** Inclusive Athens YYYY-MM-DD span ending at `endYmd`, length `n`. */
export function lastNAthensYmds(n: number, endYmd = getTodayYmdAthens()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(addDaysAthensYmd(endYmd, -i));
  }
  return out;
}

export function monthBoundsYmd(yearMonth: string): { startYmd: string; endYmd: string } {
  const [ys, ms] = yearMonth.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    const today = getTodayYmdAthens();
    return { startYmd: `${today.slice(0, 7)}-01`, endYmd: today };
  }
  const startYmd = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(y, m, 0, 12, 0, 0));
  const endYmd = last.toISOString().slice(0, 10);
  return { startYmd, endYmd };
}

/** Cap month end at today (Athens) for the current month. */
export function resolveMonthRangeAthens(yearMonth: string): { startYmd: string; endYmd: string } {
  const { startYmd, endYmd } = monthBoundsYmd(yearMonth);
  const today = getTodayYmdAthens();
  if (yearMonth === today.slice(0, 7) && endYmd > today) {
    return { startYmd, endYmd: today };
  }
  return { startYmd, endYmd };
}

function dayLabel(ymd: string): string {
  const [, mo, da] = ymd.split("-");
  return `${Number(mo)}/${Number(da)}`;
}

/** Sum employee-report sales by Athens date. */
export function teamSalesByDay(rows: InflowwDailyStatsRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const d = (r.date ?? "").slice(0, 10);
    if (!d) continue;
    map.set(d, (map.get(d) ?? 0) + (r.sales ?? 0));
  }
  return map;
}

export function sumSalesForYmd(rows: InflowwDailyStatsRow[], ymd: string): number {
  const day = ymd.slice(0, 10);
  let total = 0;
  for (const r of rows) {
    if ((r.date ?? "").slice(0, 10) === day) total += r.sales ?? 0;
  }
  return total;
}

/** Latest `synced_at` among rows for an Athens day (null if none). */
export function latestSyncedAtForYmd(
  rows: InflowwDailyStatsRow[],
  ymd: string
): string | null {
  const day = ymd.slice(0, 10);
  let latestMs = 0;
  let latestIso: string | null = null;
  for (const r of rows) {
    if ((r.date ?? "").slice(0, 10) !== day) continue;
    const iso = (r.synced_at ?? "").trim();
    if (!iso) continue;
    const ms = Date.parse(iso);
    if (!Number.isNaN(ms) && ms >= latestMs) {
      latestMs = ms;
      latestIso = new Date(ms).toISOString();
    }
  }
  return latestIso;
}

export function sumSalesInRange(
  rows: InflowwDailyStatsRow[],
  startYmd: string,
  endYmd: string
): number {
  let total = 0;
  for (const r of rows) {
    const d = (r.date ?? "").slice(0, 10);
    if (d >= startYmd && d <= endYmd) total += r.sales ?? 0;
  }
  return total;
}

/** Last 7 days sparkline + WoW vs prior 7 (employee daily sales). */
export function buildAdminSparklineWowFromDailyStats(
  rows: InflowwDailyStatsRow[],
  todayYmd = getTodayYmdAthens()
): AdminSparklineWow {
  const ymds = lastNAthensYmds(14, todayYmd);
  const byDay = teamSalesByDay(rows);
  for (const y of ymds) {
    if (!byDay.has(y)) byDay.set(y, 0);
  }

  const last7 = ymds.slice(-7);
  const prev7 = ymds.slice(0, 7);

  const sparkline7: AdminSparklineDay[] = last7.map((ymd) => ({
    ymd,
    label: dayLabel(ymd),
    usd: byDay.get(ymd) ?? 0,
  }));

  const thisWeekUsd = last7.reduce((s, y) => s + (byDay.get(y) ?? 0), 0);
  const prevWeekUsd = prev7.reduce((s, y) => s + (byDay.get(y) ?? 0), 0);
  const change = computePctChange(thisWeekUsd, prevWeekUsd);

  return {
    sparkline7,
    thisWeekUsd,
    prevWeekUsd,
    wowPercent: change.pct_change,
  };
}

export function buildDailyRevenueSeries(
  rows: InflowwDailyStatsRow[],
  ymds: string[]
): AdminDayAmount[] {
  const byDay = teamSalesByDay(rows);
  return ymds.map((ymd) => ({
    ymd,
    label: dayLabel(ymd),
    usd: byDay.get(ymd) ?? 0,
  }));
}

/** Rank chatters by sales in range (employee daily stats). */
export function rankChattersBySales(
  rows: InflowwDailyStatsRow[],
  startYmd: string,
  endYmd: string,
  nameByUserUuid: Map<string, string>
): AdminNamedAmount[] {
  const byUser = new Map<string, number>();
  for (const r of rows) {
    const d = (r.date ?? "").slice(0, 10);
    if (d < startYmd || d > endYmd) continue;
    const uid = r.user_id;
    if (!uid) continue;
    byUser.set(uid, (byUser.get(uid) ?? 0) + (r.sales ?? 0));
  }
  return [...byUser.entries()]
    .map(([uid, usd]) => ({
      name: nameByUserUuid.get(uid)?.trim() || "—",
      usd,
    }))
    .filter((r) => r.usd > 0)
    .sort((a, b) => b.usd - a.usd);
}

/**
 * Rank models by gross from synced creator transactions.
 * (Creator daily stats have no sales column — transactions are the revenue source.)
 */
export function rankModelsByTransactionGross(
  transactions: Array<Pick<CreatorTransactionRow, "amount" | "model_record_id">>,
  nameByModelRecordId: Map<string, string>
): AdminNamedAmount[] {
  const byModel = new Map<string, number>();
  for (const t of transactions) {
    const mid = t.model_record_id?.trim() || "";
    const key = mid || "__unknown__";
    byModel.set(key, (byModel.get(key) ?? 0) + (t.amount ?? 0));
  }
  return [...byModel.entries()]
    .map(([key, usd]) => ({
      name: key === "__unknown__" ? "—" : nameByModelRecordId.get(key)?.trim() || "—",
      usd,
    }))
    .filter((r) => r.usd > 0)
    .sort((a, b) => b.usd - a.usd);
}

export function buildMonthlyTargetProgress(params: {
  targetUsd: number;
  achievedUsd: number;
  targetCount: number;
}): AdminMonthlyTargetProgress {
  const targetUsd = Math.max(0, params.targetUsd);
  const achievedUsd = Math.max(0, params.achievedUsd);
  const progressPct =
    targetUsd > 0 ? Math.min(100, (achievedUsd / targetUsd) * 100) : 0;
  return {
    targetUsd,
    achievedUsd,
    progressPct,
    targetCount: Math.max(0, params.targetCount),
  };
}

const LARGE_TX_USD = 100;

function whaleTimestampMs(t: WhaleTransaction): number {
  const iso = t.created_at?.trim();
  if (iso) {
    const ms = Date.parse(iso);
    if (!Number.isNaN(ms)) return ms;
  }
  const day = (t.date ?? "").slice(0, 10);
  const time = (t.time ?? "").trim();
  if (day && time) {
    const combined = `${day}T${time.includes("T") ? time.split("T").pop() : time}`;
    const ms = Date.parse(combined);
    if (!Number.isNaN(ms)) return ms;
  }
  if (day) {
    const ms = Date.parse(`${day}T12:00:00`);
    if (!Number.isNaN(ms)) return ms;
  }
  return 0;
}

/**
 * Diversified recent activity: large Infloww txs, model lives, customs,
 * with whale sessions as a secondary signal.
 */
export function buildAdminRecentActivity(params: {
  transactions: CreatorTransactionRow[];
  modelNamesByRecordId: Map<string, string>;
  liveStreams: ModelLiveStreamRecord[];
  modelNamesByLiveModelId: Map<string, string>;
  customs: CustomRequest[];
  whaleTransactions?: WhaleTransaction[];
  limit?: number;
}): AdminRecentActivityItem[] {
  const limit = params.limit ?? 12;
  const items: AdminRecentActivityItem[] = [];

  const largeTxs = [...params.transactions]
    .filter((t) => (t.amount ?? 0) >= LARGE_TX_USD)
    .sort((a, b) => {
      const tb = Date.parse(b.created_time ?? "") || 0;
      const ta = Date.parse(a.created_time ?? "") || 0;
      return tb - ta;
    })
    .slice(0, 40);

  for (const t of largeTxs) {
    const ms = Date.parse(t.created_time ?? "") || 0;
    const atIso = ms > 0 ? new Date(ms).toISOString() : new Date(0).toISOString();
    const model =
      (t.model_record_id && params.modelNamesByRecordId.get(t.model_record_id)) ||
      t.model_name ||
      "—";
    const amt = t.amount ?? 0;
    items.push({
      id: `tx-${t.transaction_id}`,
      kind: "large_transaction",
      title: `Large sale · $${amt.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      subtitle: `${model} · ${(t.type ?? "sale").replace(/_/g, " ")} · ${t.fan_name?.trim() || "Fan"}`,
      atIso,
    });
  }

  const lives = [...params.liveStreams]
    .sort((a, b) => {
      const tb = Date.parse(b.actual_start || b.planned_start || b.created_at || "") || 0;
      const ta = Date.parse(a.actual_start || a.planned_start || a.created_at || "") || 0;
      return tb - ta;
    })
    .slice(0, 30);

  for (const live of lives) {
    const st = (live.status ?? "").toLowerCase();
    const active = st === "live" || st === "in_progress";
    const ms =
      Date.parse(live.actual_start || live.planned_start || live.created_at || "") || 0;
    const atIso = ms > 0 ? new Date(ms).toISOString() : new Date(0).toISOString();
    const name = params.modelNamesByLiveModelId.get(live.model_id)?.trim() || "Model";
    items.push({
      id: `live-${live.id}`,
      kind: "model_live",
      title: active ? `${name} went live` : `${name} · live session`,
      subtitle: `${live.platform?.trim() || "Platform"} · ${st || "scheduled"}`,
      atIso,
    });
  }

  const customsRecent = [...params.customs]
    .sort((a, b) => {
      const tb = Date.parse(b.created_at ?? "") || 0;
      const ta = Date.parse(a.created_at ?? "") || 0;
      return tb - ta;
    })
    .slice(0, 40);

  for (const c of customsRecent) {
    const raw = c.created_at?.trim();
    const parsed = raw ? Date.parse(raw) : NaN;
    const atIso = !Number.isNaN(parsed) ? new Date(parsed).toISOString() : new Date(0).toISOString();
    items.push({
      id: `cr-${c.id}`,
      kind: "custom_request",
      title: c.request_title?.trim() || "Custom request",
      subtitle: `${c.assigned_model_name?.trim() || "—"} · ${c.fan_username?.trim() || "—"}`,
      atIso,
      pending: c.admin_status === "pending" || c.status === "pending",
    });
  }

  const whales = [...(params.whaleTransactions ?? [])]
    .sort((a, b) => whaleTimestampMs(b) - whaleTimestampMs(a))
    .slice(0, 20);

  for (const t of whales) {
    const ms = whaleTimestampMs(t);
    const atIso =
      ms > 0
        ? new Date(ms).toISOString()
        : `${(t.date ?? "1970-01-01").slice(0, 10)}T12:00:00.000Z`;
    const amt = t.amount ?? 0;
    items.push({
      id: `whale-${t.id}`,
      kind: "whale_session",
      title: "Whale session logged",
      subtitle: `$${amt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · ${t.model_name?.trim() || "—"} · ${t.chatter_name?.trim() || "—"}`,
      atIso,
    });
  }

  // Prefer operational + revenue signals; demote whale sessions when mixed.
  const rank = (k: AdminRecentActivityKind): number => {
    if (k === "large_transaction") return 0;
    if (k === "model_live") return 1;
    if (k === "custom_request") return 2;
    return 3;
  };

  return items
    .sort((a, b) => {
      const tb = Date.parse(b.atIso) - Date.parse(a.atIso);
      if (Math.abs(tb) > 3_600_000) return tb;
      return rank(a.kind) - rank(b.kind);
    })
    .slice(0, limit);
}
