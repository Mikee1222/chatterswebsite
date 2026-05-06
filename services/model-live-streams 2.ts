"use server";

import {
  listAllRecords,
  getRecord,
  createRecord,
  updateRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { firstLinkedId } from "@/lib/airtable-linked";
import type { ModelLiveStreamRecord } from "@/types";

const TABLE = "model_live_streams";

type Fields = {
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
    model_id: firstLinkedId(f.model_id) ?? "",
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

export async function getModelLiveStreamById(id: string): Promise<ModelLiveStreamRecord | null> {
  try {
    const rec = await getRecord<Fields>(TABLE, id);
    return mapRecord(rec as AirtableRecord<Fields>);
  } catch {
    return null;
  }
}

export async function getActiveLiveStreamForModel(modelId: string): Promise<ModelLiveStreamRecord | null> {
  const all = await listModelLiveStreams(modelId);
  return all.find((s) => s.status === "in_progress" && !s.actual_end) ?? null;
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
    model_id: [input.model_id],
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
