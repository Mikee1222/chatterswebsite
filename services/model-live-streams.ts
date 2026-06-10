import {
  listAllRecords,
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { firstLinkedId, formulaLinkedContains } from "@/lib/airtable-linked";
import { getTodayYmdAthens } from "@/lib/airtable-datetime";
import type { ModelLiveStreamRecord } from "@/types";

const TABLE = "model_live_streams";

type Fields = {
  /** multipleRecordLinks → modelss (canonical API name); legacy: `model_id` */
  model?: string | string[];
  model_id?: string | string[];
  date?: string;
  planned_start?: string;
  planned_end?: string;
  actual_start?: string;
  actual_end?: string;
  platform?: string;
  status?: string;
  details?: string;
  details_en?: string;
  details_es?: string;
  created_at?: string;
  updated_at?: string;
};

function mapRecord(rec: AirtableRecord<Fields>): ModelLiveStreamRecord {
  const f = rec.fields;
  return {
    id: rec.id,
    model_id: firstLinkedId(f.model ?? f.model_id) ?? "",
    date: (f.date ?? "").slice(0, 10),
    planned_start: f.planned_start ?? null,
    planned_end: f.planned_end ?? null,
    actual_start: f.actual_start ?? null,
    actual_end: f.actual_end ?? null,
    platform: f.platform ?? "",
    status: f.status ?? "",
    details: f.details ?? "",
    details_en: f.details_en ?? null,
    details_es: f.details_es ?? null,
    created_at: f.created_at ?? "",
    updated_at: f.updated_at ?? "",
  };
}

export async function listModelLiveStreams(modelId: string): Promise<ModelLiveStreamRecord[]> {
  if (!modelId) return [];
  const records = await listAllRecords<Fields>(TABLE, { sort: [{ field: "date", direction: "asc" }] });
  return records
    .map(mapRecord)
    .filter((r) => r.model_id === modelId)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.planned_start ?? "").localeCompare(b.planned_start ?? ""));
}

/** All models; optional inclusive date bounds (YYYY-MM-DD). */
export async function listAllModelLiveStreamsInRange(opts?: {
  fromDate?: string;
  toDate?: string;
}): Promise<ModelLiveStreamRecord[]> {
  const records = await listAllRecords<Fields>(TABLE, { sort: [{ field: "date", direction: "asc" }] });
  let rows = records.map(mapRecord);
  if (opts?.fromDate) rows = rows.filter((r) => r.date >= opts.fromDate!);
  if (opts?.toDate) rows = rows.filter((r) => r.date <= opts.toDate!);
  rows.sort((a, b) => a.date.localeCompare(b.date) || (a.planned_start ?? "").localeCompare(b.planned_start ?? ""));
  return rows;
}

export async function getModelLiveStreamById(id: string): Promise<ModelLiveStreamRecord | null> {
  try {
    const rec = await getRecord<Fields>(TABLE, id);
    return mapRecord(rec as AirtableRecord<Fields>);
  } catch {
    return null;
  }
}

/** True when this row represents an active ad-hoc or in-session live (not ended). */
export function isActiveLiveStreamRecord(r: Pick<ModelLiveStreamRecord, "status" | "actual_end">): boolean {
  if (r.actual_end) return false;
  const st = (r.status ?? "").trim().toLowerCase();
  return st === "live" || st === "in_progress";
}

export async function getActiveLiveStreamForModel(modelId: string): Promise<ModelLiveStreamRecord | null> {
  if (!modelId) return null;
  const formula = `AND(${formulaLinkedContains("model", modelId)}, OR({status} = "in_progress", {status} = "live"), {actual_end} = "")`;
  const { records } = await listRecords<Fields>(TABLE, {
    filterByFormula: formula,
    pageSize: 1,
    _caller: "getActiveLiveStreamForModel",
  });
  return records.length > 0 ? mapRecord(records[0] as AirtableRecord<Fields>) : null;
}

export async function createModelLiveStream(input: {
  model_id: string;
  date: string;
  planned_start?: string | null;
  planned_end?: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
  platform: string;
  status?: string;
  details?: string;
  details_en?: string;
  details_es?: string;
}): Promise<ModelLiveStreamRecord> {
  const rec = await createRecord<Fields>(TABLE, {
    model: [input.model_id],
    date: input.date,
    planned_start: input.planned_start ?? undefined,
    planned_end: input.planned_end ?? undefined,
    actual_start: input.actual_start ?? undefined,
    actual_end: input.actual_end ?? undefined,
    platform: input.platform,
    status: input.status ?? "scheduled",
    details: input.details ?? "",
    details_en: input.details_en ?? undefined,
    details_es: input.details_es ?? undefined,
  });
  return mapRecord(rec as AirtableRecord<Fields>);
}

export async function updateModelLiveStream(
  id: string,
  patch: Partial<{
    date: string;
    planned_start: string | null;
    planned_end: string | null;
    actual_start: string | null;
    actual_end: string | null;
    platform: string;
    status: string;
    details: string;
    details_en: string | null;
    details_es: string | null;
  }>
): Promise<ModelLiveStreamRecord> {
  const rec = await updateRecord<Fields>(TABLE, id, patch as Partial<Fields>);
  return mapRecord(rec as AirtableRecord<Fields>);
}

export async function getLiveStreams(modelId: string): Promise<ModelLiveStreamRecord[]> {
  return listModelLiveStreams(modelId);
}
