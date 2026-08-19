/**
 * Sync + query service for Infloww creator status-change-log
 * (GET /v1/creator/status-change-log).
 *
 * History is only available from 2026-06-01 onwards.
 * Batches creator IDs ≤10 per request, paginates with cursor.
 */

import {
  fetchInflowwEmployees,
  getCreatorStatusChangeLog,
  getInflowwModels,
  inflowwReportTodayYmd,
  InflowwApiError,
  logInflowwFailure,
} from "@/lib/infloww-api";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { listAllModelss } from "@/services/modelss";
import { matchModelsToInflowwCreators } from "@/services/infloww-creator-earnings";

export const STATUS_LOG_BACKFILL_START = "2026-06-01";

export type CreatorStatusLogRow = {
  id: string;
  creator_infloww_id: string;
  model_id: string | null;
  status_before: string;
  status_after: string;
  operation_time: string;
  operation_employee_id: string | null;
  operation_employee_name: string | null;
  synced_at: string;
};

export type StatusLogSyncResult = {
  upserted: number;
  errors: Array<{ message: string; status?: number }>;
};

/** Build employeeId → name map from Infloww /employees. */
async function buildEmployeeNameMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const employees = await fetchInflowwEmployees();
    for (const e of employees) {
      if (e.employeeId && e.name) {
        map.set(String(e.employeeId), e.name);
      }
    }
  } catch (err) {
    logInflowwFailure("buildEmployeeNameMap", err);
  }
  return map;
}

/**
 * Sync status-change-log for all linked creators for a given unix-ms time window.
 * If startMs/endMs omitted, fetches the full available history (2026-06-01 → now).
 */
export async function syncCreatorStatusLog(params?: {
  startMs?: number;
  endMs?: number;
}): Promise<StatusLogSyncResult> {
  const result: StatusLogSyncResult = { upserted: 0, errors: [] };
  try {
    const [models, creators] = await Promise.all([listAllModelss(), getInflowwModels()]);
    const { linked } = matchModelsToInflowwCreators(models, creators);
    if (!linked.length) return result;

    const modelIdByCreatorId = new Map(linked.map((l) => [l.creatorInflowwId, l.modelRecordId] as const));
    const creatorIds = linked.map((l) => l.creatorInflowwId);

    const [entries, employeeMap] = await Promise.all([
      getCreatorStatusChangeLog({
        creatorIds,
        startMs: params?.startMs,
        endMs: params?.endMs,
      }),
      buildEmployeeNameMap(),
    ]);

    if (!entries.length) return result;

    const now = new Date().toISOString();
    const payload = entries.map((e) => ({
      id: e.id,
      creator_infloww_id: e.creatorId,
      model_id: modelIdByCreatorId.get(e.creatorId) ?? null,
      status_before: e.statusBefore,
      status_after: e.statusAfter,
      operation_time: e.operationTimeMs > 0 ? new Date(e.operationTimeMs).toISOString() : now,
      operation_employee_id: e.operationEmployeeId ?? null,
      operation_employee_name:
        e.operationEmployeeId ? (employeeMap.get(e.operationEmployeeId) ?? null) : null,
      synced_at: now,
    }));

    const sb = getSupabaseServiceClient();
    const { error, count } = await sb
      .from("infloww_creator_status_log")
      .upsert(payload, { onConflict: "id", count: "exact" });
    if (error) throw new Error(`upsert infloww_creator_status_log: ${error.message}`);
    result.upserted = count ?? payload.length;
  } catch (err) {
    logInflowwFailure("syncCreatorStatusLog", err);
    result.errors.push({
      message: err instanceof Error ? err.message : String(err),
      status: err instanceof InflowwApiError ? err.status : undefined,
    });
  }
  return result;
}

/**
 * Backfill from 2026-06-01 to today.
 * Safe to call repeatedly — upserts on `id` PK.
 */
export async function backfillCreatorStatusLog(): Promise<StatusLogSyncResult> {
  const backfillStart = new Date(`${STATUS_LOG_BACKFILL_START}T00:00:00.000Z`).getTime();
  const now = Date.now() - 2000;
  return syncCreatorStatusLog({ startMs: backfillStart, endMs: now });
}

/** Daily incremental sync — last 48h to catch any delayed events. */
export async function dailySyncCreatorStatusLog(): Promise<StatusLogSyncResult> {
  const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;
  const now = Date.now() - 2000;
  return syncCreatorStatusLog({ startMs: twoDaysAgo, endMs: now });
}

export async function listCreatorStatusLog(params: {
  modelId?: string;
  creatorInflowwId?: string;
  startYmd?: string;
  endYmd?: string;
  limit?: number;
}): Promise<CreatorStatusLogRow[]> {
  const sb = getSupabaseServiceClient();
  let q = sb
    .from("infloww_creator_status_log")
    .select(
      "id, creator_infloww_id, model_id, status_before, status_after, operation_time, operation_employee_id, operation_employee_name, synced_at"
    )
    .order("operation_time", { ascending: false })
    .limit(params.limit ?? 500);
  if (params.modelId) q = q.eq("model_id", params.modelId);
  if (params.creatorInflowwId) q = q.eq("creator_infloww_id", params.creatorInflowwId);
  if (params.startYmd) q = q.gte("operation_time", `${params.startYmd}T00:00:00.000Z`);
  if (params.endYmd) q = q.lte("operation_time", `${params.endYmd}T23:59:59.999Z`);
  const { data, error } = await q;
  if (error) throw new Error(`listCreatorStatusLog: ${error.message}`);
  return (data ?? []) as CreatorStatusLogRow[];
}

/** Counts per model — used for the overview table. */
export async function listCreatorStatusLogSummary(params?: {
  startYmd?: string;
}): Promise<Array<{ model_id: string | null; creator_infloww_id: string; count: number; latest: string | null }>> {
  const sb = getSupabaseServiceClient();
  let q = sb
    .from("infloww_creator_status_log")
    .select("model_id, creator_infloww_id, operation_time");
  if (params?.startYmd) q = q.gte("operation_time", `${params.startYmd}T00:00:00.000Z`);
  const { data, error } = await q;
  if (error) throw new Error(`listCreatorStatusLogSummary: ${error.message}`);
  const map = new Map<string, { model_id: string | null; creator_infloww_id: string; count: number; latest: string | null }>();
  for (const row of data ?? []) {
    const k = String(row.creator_infloww_id);
    const prev = map.get(k) ?? { model_id: row.model_id ? String(row.model_id) : null, creator_infloww_id: k, count: 0, latest: null };
    prev.count += 1;
    const t = row.operation_time ? String(row.operation_time) : null;
    if (t && (!prev.latest || t > prev.latest)) prev.latest = t;
    map.set(k, prev);
  }
  return [...map.values()].sort((a, b) => (b.latest ?? "").localeCompare(a.latest ?? ""));
}
