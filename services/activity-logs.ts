"use server";

import { listRecords, listAllRecords, createRecord, type AirtableRecord, type ListParams } from "@/lib/airtable-server";
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
  const { records, offset } = await listRecords<Fields>(TABLE, {
    ...params,
    sort: params.sort ?? [{ field: "created_at", direction: "desc" }],
  });
  return { logs: records.map(mapRecord), offset };
}

export async function listRecentActivityLogs(limit = 20) {
  const { logs } = await listActivityLogs({ pageSize: limit });
  return logs;
}

export async function createActivityLog(fields: Partial<Fields>) {
  const rec = await createRecord(TABLE, fields);
  return mapRecord(rec as AirtableRecord<Fields>);
}
