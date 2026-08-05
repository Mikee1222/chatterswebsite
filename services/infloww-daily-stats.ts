/**
 * Supabase storage + sync for Infloww employee daily sales/chat stats.
 * Production path is Supabase-only (infloww_daily_stats table).
 */

import { getTodayYmdAthens, addDaysAthensYmd } from "@/lib/airtable-datetime";
import {
  EMPLOYEE_REPORT_MAX_LOOKBACK_DAYS,
  fetchEmployeeDayStats,
  InflowwApiError,
  logInflowwFailure,
} from "@/lib/infloww-api";
import { publicId } from "@/lib/supabase-data";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import type { InflowwEmployeeDayStats } from "@/types/infloww";

export type InflowwDailyStatsRow = {
  id: string;
  user_id: string;
  infloww_employee_id: number;
  infloww_performer_id: number;
  date: string;
  performer_name: string | null;
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
  avg_earnings_per_spending_fan: number | null;
  response_time_seconds: number | null;
  sales_per_hour: number | null;
  messages_per_hour: number | null;
  fans_chatted_per_hour: number | null;
  synced_at: string;
};

export type LinkedInflowwUser = {
  /** Postgres UUID */
  uuid: string;
  /** Public / Airtable-shaped id */
  publicId: string;
  full_name: string;
  infloww_employee_id: number;
};

export type InflowwSyncResult = {
  startYmd: string;
  endYmd: string;
  usersTargeted: number;
  rowsUpserted: number;
  errors: Array<{ employeeId: number; message: string; status?: number; path?: string }>;
};

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function nNull(v: unknown): number | null {
  if (v == null) return null;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : null;
}

function mapDbRow(row: Record<string, unknown>): InflowwDailyStatsRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    infloww_employee_id: n(row.infloww_employee_id),
    infloww_performer_id: n(row.infloww_performer_id),
    date: String(row.date).slice(0, 10),
    performer_name: typeof row.performer_name === "string" ? row.performer_name : null,
    sales: n(row.sales),
    ppv_sales: n(row.ppv_sales),
    tips: n(row.tips),
    dm_sales: n(row.dm_sales),
    pmm_sales: n(row.pmm_sales),
    ofmm_sales: n(row.ofmm_sales),
    messages_sent: Math.round(n(row.messages_sent)),
    ppvs_sent: Math.round(n(row.ppvs_sent)),
    fans_chatted: Math.round(n(row.fans_chatted)),
    fans_who_spent: Math.round(n(row.fans_who_spent)),
    golden_ratio: nNull(row.golden_ratio),
    fan_cvr: nNull(row.fan_cvr),
    avg_earnings_per_spending_fan: nNull(row.avg_earnings_per_spending_fan),
    response_time_seconds: nNull(row.response_time_seconds),
    sales_per_hour: nNull(row.sales_per_hour),
    messages_per_hour: nNull(row.messages_per_hour),
    fans_chatted_per_hour: nNull(row.fans_chatted_per_hour),
    synced_at: String(row.synced_at ?? ""),
  };
}

/** Users with an Infloww employee id set (Supabase). */
export async function listUsersWithInflowwEmployeeId(): Promise<LinkedInflowwUser[]> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("users")
    .select("id, airtable_id, full_name, infloww_employee_id")
    .not("infloww_employee_id", "is", null);
  if (error) throw new Error(`listUsersWithInflowwEmployeeId: ${error.message}`);
  const out: LinkedInflowwUser[] = [];
  for (const row of data ?? []) {
    const emp = row.infloww_employee_id;
    const empN = typeof emp === "number" ? emp : Number(emp);
    if (!Number.isFinite(empN) || empN <= 0) continue;
    out.push({
      uuid: String(row.id),
      publicId: publicId({ id: String(row.id), airtable_id: row.airtable_id }),
      full_name: String(row.full_name ?? ""),
      infloww_employee_id: empN,
    });
  }
  return out;
}

export async function getUserInflowwLinkByPublicId(
  publicUserId: string
): Promise<LinkedInflowwUser | null> {
  const sb = getSupabaseServiceClient();
  const id = publicUserId.trim();
  if (!id) return null;
  let q = sb
    .from("users")
    .select("id, airtable_id, full_name, infloww_employee_id")
    .eq("airtable_id", id)
    .maybeSingle();
  let { data, error } = await q;
  if (error) throw new Error(`getUserInflowwLinkByPublicId: ${error.message}`);
  if (!data) {
    const byUuid = await sb
      .from("users")
      .select("id, airtable_id, full_name, infloww_employee_id")
      .eq("id", id)
      .maybeSingle();
    if (byUuid.error) throw new Error(`getUserInflowwLinkByPublicId: ${byUuid.error.message}`);
    data = byUuid.data;
  }
  if (!data) return null;
  const empN = typeof data.infloww_employee_id === "number"
    ? data.infloww_employee_id
    : Number(data.infloww_employee_id);
  if (!Number.isFinite(empN) || empN <= 0) {
    return {
      uuid: String(data.id),
      publicId: publicId({ id: String(data.id), airtable_id: data.airtable_id }),
      full_name: String(data.full_name ?? ""),
      infloww_employee_id: 0,
    };
  }
  return {
    uuid: String(data.id),
    publicId: publicId({ id: String(data.id), airtable_id: data.airtable_id }),
    full_name: String(data.full_name ?? ""),
    infloww_employee_id: empN,
  };
}

async function upsertDayStats(
  userUuid: string,
  employeeId: number,
  rows: InflowwEmployeeDayStats[]
): Promise<number> {
  if (!rows.length) return 0;
  const sb = getSupabaseServiceClient();
  const now = new Date().toISOString();
  const payload = rows.map((r) => ({
    user_id: userUuid,
    infloww_employee_id: employeeId,
    infloww_performer_id: r.performerId || 0,
    date: r.date,
    performer_name: r.performerName ?? null,
    sales: r.sales,
    ppv_sales: r.ppvSales,
    tips: r.tips,
    dm_sales: r.dmSales,
    pmm_sales: r.pmmSales,
    ofmm_sales: r.ofmmSales,
    messages_sent: r.messagesSent,
    ppvs_sent: r.ppvsSent,
    fans_chatted: r.fansChatted,
    fans_who_spent: r.fansWhoSpent,
    golden_ratio: r.goldenRatio,
    fan_cvr: r.fanCvr,
    avg_earnings_per_spending_fan: r.avgEarningsPerSpendingFan,
    response_time_seconds: r.responseTimeSeconds,
    sales_per_hour: r.salesPerHour,
    messages_per_hour: r.messagesPerHour,
    fans_chatted_per_hour: r.fansChattedPerHour,
    synced_at: now,
    updated_at: now,
  }));

  const { error, count } = await sb.from("infloww_daily_stats").upsert(payload, {
    onConflict: "user_id,infloww_performer_id,date",
    count: "exact",
  });
  if (error) throw new Error(`upsert infloww_daily_stats: ${error.message}`);
  return count ?? payload.length;
}

/**
 * Sync Infloww employee stats for a date range into `infloww_daily_stats`.
 * Defaults to previous Athens calendar day when dates omitted.
 * Upserts on `(user_id, infloww_performer_id, date)` — same-day re-sync overwrites.
 */
export async function syncInflowwDailyStats(params?: {
  startYmd?: string;
  endYmd?: string;
  /** Limit to specific public user ids (optional). */
  publicUserIds?: string[];
}): Promise<InflowwSyncResult> {
  const today = getTodayYmdAthens();
  const defaultDay = addDaysAthensYmd(today, -1);
  let startYmd = (params?.startYmd ?? defaultDay).slice(0, 10);
  let endYmd = (params?.endYmd ?? defaultDay).slice(0, 10);
  if (startYmd > endYmd) {
    const t = startYmd;
    startYmd = endYmd;
    endYmd = t;
  }

  const earliest = addDaysAthensYmd(today, -(EMPLOYEE_REPORT_MAX_LOOKBACK_DAYS - 1));
  if (startYmd < earliest) startYmd = earliest;
  if (endYmd > today) endYmd = today;

  let users = await listUsersWithInflowwEmployeeId();
  if (params?.publicUserIds?.length) {
    const want = new Set(params.publicUserIds.map((x) => x.trim()).filter(Boolean));
    users = users.filter((u) => want.has(u.publicId) || want.has(u.uuid));
  }

  const result: InflowwSyncResult = {
    startYmd,
    endYmd,
    usersTargeted: users.length,
    rowsUpserted: 0,
    errors: [],
  };

  if (!users.length) return result;

  // Group by employee id in case multiple app users share one (unlikely).
  const byEmployee = new Map<number, LinkedInflowwUser[]>();
  for (const u of users) {
    const list = byEmployee.get(u.infloww_employee_id) ?? [];
    list.push(u);
    byEmployee.set(u.infloww_employee_id, list);
  }

  for (const [employeeId, linked] of byEmployee) {
    try {
      const stats = await fetchEmployeeDayStats({
        startYmd,
        endYmd,
        employeeIds: [employeeId],
      });
      for (const user of linked) {
        const forUser = stats.filter((s) => s.employeeId === employeeId || s.employeeId === 0);
        // If API returns employeeId=0 / missing, still attribute when we filtered the request.
        const rows = forUser.length ? forUser : stats;
        result.rowsUpserted += await upsertDayStats(user.uuid, employeeId, rows);
      }
    } catch (err) {
      const message =
        err instanceof InflowwApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      logInflowwFailure("employee sync failed", err, {
        employeeId,
        startYmd,
        endYmd,
        userCount: linked.length,
      });
      result.errors.push({
        employeeId,
        message,
        ...(err instanceof InflowwApiError
          ? { status: err.status, path: err.path || undefined }
          : {}),
      });
    }
  }

  return result;
}

export async function queryInflowwDailyStats(params: {
  /** Postgres user UUIDs. */
  userUuids?: string[];
  startYmd: string;
  endYmd: string;
  performerId?: number;
}): Promise<InflowwDailyStatsRow[]> {
  const sb = getSupabaseServiceClient();
  const pageSize = 1000;
  const out: InflowwDailyStatsRow[] = [];
  let from = 0;

  for (;;) {
    let q = sb
      .from("infloww_daily_stats")
      .select("*")
      .gte("date", params.startYmd.slice(0, 10))
      .lte("date", params.endYmd.slice(0, 10))
      .order("date", { ascending: true })
      .order("user_id", { ascending: true })
      .order("infloww_performer_id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (params.userUuids?.length) {
      q = q.in("user_id", params.userUuids);
    }
    if (params.performerId != null && Number.isFinite(params.performerId)) {
      q = q.eq("infloww_performer_id", params.performerId);
    }

    const { data, error } = await q;
    if (error) throw new Error(`queryInflowwDailyStats: ${error.message}`);
    const batch = data ?? [];
    for (const r of batch) out.push(mapDbRow(r as Record<string, unknown>));
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return out;
}
