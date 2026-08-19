/**
 * Supabase sync for Infloww manual sales reassignment log.
 * Source: GET /v1/transaction-perf/manual-assignment/details (requires organization scope)
 */

import {
  fetchReassignedSalesLogForRange,
  fetchInflowwEmployees,
  InflowwApiError,
  logInflowwFailure,
  inflowwReportTodayYmd,
} from "@/lib/infloww-api";
import type { InflowwReassignmentEntry } from "@/lib/infloww-api";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

export interface SalesReassignmentSyncResult {
  upserted: number;
  errors: string[];
}

export interface InflowwSalesReassignment {
  id: string;
  transactionId: string;
  transactionPerfId: string;
  operationType: string;
  operationEmployeeId: string | null;
  operationEmployeeName: string | null;
  beforeEmployeeId: string | null;
  beforeEmployeeName: string | null;
  afterEmployeeId: string | null;
  afterEmployeeName: string | null;
  createdTime: string | null;
  syncedAt: string;
}

async function buildEmployeeNameMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  // Primary: users table infloww_employee_id → full_name (matches the IDs in manual-assignment)
  try {
    const supabase = getSupabaseServiceClient();
    const { data } = await supabase
      .from("users")
      .select("full_name, infloww_employee_id")
      .not("infloww_employee_id", "is", null);
    for (const row of data ?? []) {
      if (row.infloww_employee_id && row.full_name) {
        map.set(String(row.infloww_employee_id), row.full_name as string);
      }
    }
  } catch {
    // fallthrough to Infloww API
  }

  // Secondary: /v1/employees endpoint (uses different ID space but may overlap)
  try {
    const employees = await fetchInflowwEmployees();
    for (const emp of employees) {
      const key = String(emp.employeeId);
      if (!map.has(key)) map.set(key, emp.name);
    }
  } catch {
    // best-effort
  }

  return map;
}

function toSupabaseRecord(
  entry: InflowwReassignmentEntry,
  empNames: Map<string, string>
) {
  const nameOf = (id: string | undefined) =>
    id ? (empNames.get(id) ?? null) : null;

  return {
    id: entry.id,
    transaction_id: entry.transactionId,
    transaction_perf_id: entry.transactionPerfId,
    operation_type: entry.operationType,
    operation_employee_id: entry.operationEmployeeId ?? null,
    operation_employee_name: nameOf(entry.operationEmployeeId),
    before_employee_id: entry.beforeEmployeeId ?? null,
    before_employee_name: nameOf(entry.beforeEmployeeId),
    after_employee_id: entry.afterEmployeeId ?? null,
    after_employee_name: nameOf(entry.afterEmployeeId),
    created_time:
      entry.createdTimeMs > 0 ? new Date(entry.createdTimeMs).toISOString() : null,
    synced_at: new Date().toISOString(),
  };
}

export async function syncSalesReassignments(params: {
  startYmd: string;
  endYmd: string;
}): Promise<SalesReassignmentSyncResult> {
  const errors: string[] = [];
  let upserted = 0;

  let entries: InflowwReassignmentEntry[] = [];
  try {
    entries = await fetchReassignedSalesLogForRange(params);
  } catch (e) {
    if (e instanceof InflowwApiError && e.status === 403) {
      errors.push("403 Forbidden — organization scope may not be active yet");
      return { upserted, errors };
    }
    logInflowwFailure("syncSalesReassignments/fetch", e);
    errors.push(e instanceof Error ? e.message : String(e));
    return { upserted, errors };
  }

  if (entries.length === 0) {
    return { upserted: 0, errors };
  }

  const empNames = await buildEmployeeNameMap();
  const records = entries.map((e) => toSupabaseRecord(e, empNames));

  const supabase = getSupabaseServiceClient();
  const BATCH = 500;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { error } = await supabase
      .from("infloww_sales_reassignments")
      .upsert(batch, { onConflict: "id" });
    if (error) {
      errors.push(`Supabase upsert batch ${i / BATCH + 1}: ${error.message}`);
    } else {
      upserted += batch.length;
    }
  }

  return { upserted, errors };
}

/**
 * Daily incremental sync: today + yesterday.
 */
export async function dailySyncSalesReassignments(): Promise<SalesReassignmentSyncResult> {
  const today = inflowwReportTodayYmd();
  const yesterday = (() => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  })();
  return syncSalesReassignments({ startYmd: yesterday, endYmd: today });
}

/**
 * Fetch all reassignment rows from Supabase (most recent first).
 */
export async function getSalesReassignments(params?: {
  limit?: number;
}): Promise<InflowwSalesReassignment[]> {
  const supabase = getSupabaseServiceClient();
  let query = supabase
    .from("infloww_sales_reassignments")
    .select("*")
    .order("created_time", { ascending: false });

  if (params?.limit) query = query.limit(params.limit);

  const { data, error } = await query;
  if (error) throw new Error(`infloww_sales_reassignments fetch: ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    transactionId: r.transaction_id as string,
    transactionPerfId: r.transaction_perf_id as string,
    operationType: r.operation_type as string,
    operationEmployeeId: r.operation_employee_id ?? null,
    operationEmployeeName: r.operation_employee_name ?? null,
    beforeEmployeeId: r.before_employee_id ?? null,
    beforeEmployeeName: r.before_employee_name ?? null,
    afterEmployeeId: r.after_employee_id ?? null,
    afterEmployeeName: r.after_employee_name ?? null,
    createdTime: r.created_time ?? null,
    syncedAt: r.synced_at as string,
  }));
}
