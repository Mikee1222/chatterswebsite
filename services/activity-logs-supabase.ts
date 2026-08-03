/**
 * Supabase backend for services/activity-logs.ts
 */
import { publicId, sbInsert, sbSelectAll, type SbRow } from "@/lib/supabase-data";
import type { ActivityLog } from "@/types";
import type { ListParams } from "@/lib/airtable-server";
import type { ActivityLogQueryFilters } from "./activity-logs";

const TABLE = "activity_logs";

type Row = SbRow & {
  log_id?: string | null;
  actor_user_id?: string | null;
  actor_name?: string | null;
  action_type?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  summary?: string | null;
  details?: string | null;
  created_at?: string | null;
};

function mapRow(row: Row): ActivityLog {
  return {
    id: publicId(row),
    log_id: row.log_id ?? "",
    actor_user_id: row.actor_user_id ?? "",
    actor_name: row.actor_name ?? "",
    action_type: row.action_type ?? "",
    entity_type: row.entity_type ?? "",
    entity_id: row.entity_id ?? "",
    summary: row.summary ?? "",
    details: row.details ?? "",
    created_at: row.created_at ?? "",
  };
}

function matchesFilters(log: ActivityLog, filters: ActivityLogQueryFilters): boolean {
  if (filters.action?.trim()) {
    const needle = filters.action.trim().toLowerCase();
    if (!log.action_type.toLowerCase().includes(needle)) return false;
  }
  if (filters.actor?.trim()) {
    const needle = filters.actor.trim().toLowerCase();
    if (!log.actor_name.toLowerCase().includes(needle)) return false;
  }
  return true;
}

export async function listActivityLogs(params: ListParams & { filterByFormula?: string } = {}) {
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 50));
  const rows = await sbSelectAll<Row>(TABLE);
  let logs = rows.map(mapRow).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  // formula filters are Airtable-specific; ignore and return capped list
  const MAX_RECORDS = 200;
  logs = logs.slice(0, MAX_RECORDS);
  if (params.pageSize) logs = logs.slice(0, pageSize);
  return { logs, offset: undefined as string | undefined };
}

export async function listRecentActivityLogs(limit = 20) {
  const { logs } = await listActivityLogs({ pageSize: limit });
  return logs;
}

export async function createActivityLog(fields: Partial<Row>) {
  const row = await sbInsert<Row>(TABLE, {
    ...fields,
    created_at: fields.created_at ?? new Date().toISOString(),
  });
  return mapRow(row);
}

export function filterActivityLogsClient(
  logs: ActivityLog[],
  filters: ActivityLogQueryFilters
): ActivityLog[] {
  return logs.filter((l) => matchesFilters(l, filters));
}
