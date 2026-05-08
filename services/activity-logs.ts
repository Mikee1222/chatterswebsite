import { listRecords, createRecord, type AirtableRecord, type ListParams } from "@/lib/airtable-server";
import type { ActivityLog } from "@/types";

const TABLE = "activity_logs";

type Fields = {
  log_id?: string;
  actor_user_id?: string;
  actor_name?: string;
  action_type?: string;
  entity_type?: string;
  entity_id?: string;
  summary?: string;
  details?: string;
  created_at?: string;
};

function mapRecord(rec: AirtableRecord<Fields>): ActivityLog {
  const f = rec.fields;
  return {
    id: rec.id,
    log_id: f.log_id ?? "",
    actor_user_id: f.actor_user_id ?? "",
    actor_name: f.actor_name ?? "",
    action_type: f.action_type ?? "",
    entity_type: f.entity_type ?? "",
    entity_id: f.entity_id ?? "",
    summary: f.summary ?? "",
    details: f.details ?? "",
    created_at: f.created_at ?? "",
  };
}

export async function listActivityLogs(params: ListParams & { filterByFormula?: string } = {}) {
  const sort = params.sort ?? [{ field: "created_at", direction: "desc" as const }];
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 50));
  const hasFilter = typeof params.filterByFormula === "string" && params.filterByFormula.trim().length > 0;
  if (hasFilter) {
    const { records, offset } = await listRecords<Fields>(TABLE, {
      ...params,
      pageSize,
      sort,
    });
    return { logs: records.map(mapRecord), offset };
  }

  // Safety cap: never stream unlimited activity logs when no filter is provided.
  const MAX_RECORDS = 200;
  const all: AirtableRecord<Fields>[] = [];
  let offset: string | undefined;
  do {
    const page = await listRecords<Fields>(TABLE, {
      ...params,
      pageSize,
      offset,
      sort,
    });
    all.push(...page.records);
    offset = page.offset;
  } while (offset && all.length < MAX_RECORDS);

  return { logs: all.slice(0, MAX_RECORDS).map(mapRecord), offset };
}

export async function listRecentActivityLogs(limit = 20) {
  const { logs } = await listActivityLogs({ pageSize: limit });
  return logs;
}

export type ActivityLogQueryFilters = {
  action?: string;
  actor?: string;
};

/** Escape single quotes before interpolating user input in Airtable formulas. */
export const safeFormulaValue = (s: string): string => s.replace(/'/g, "\\'");

export function buildActivityLogsFilterByFormula(filters: ActivityLogQueryFilters): string | undefined {
  const filterParts: string[] = [];
  if (filters.action?.trim()) {
    filterParts.push(`FIND('${safeFormulaValue(filters.action.trim())}', LOWER({action_type}))`);
  }
  if (filters.actor?.trim()) {
    filterParts.push(`FIND('${safeFormulaValue(filters.actor.trim())}', LOWER({actor_name}))`);
  }
  if (filterParts.length === 0) return undefined;
  return filterParts.length === 1 ? filterParts[0] : `AND(${filterParts.join(", ")})`;
}

export async function createActivityLog(fields: Partial<Fields>) {
  const rec = await createRecord(TABLE, fields);
  return mapRecord(rec as AirtableRecord<Fields>);
}
