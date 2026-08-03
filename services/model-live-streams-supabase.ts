/**
 * Supabase backend for services/model-live-streams.ts
 */

import {
  publicId,
  sbFirstLinkedAirtableId,
  sbInsert,
  sbSelectAll,
  sbSelectByPublicId,
  sbUpdateByPublicId,
  requireSbUuids,
  type SbRow,
} from "@/lib/supabase-data";
import type { ModelLiveStreamRecord } from "@/types";

const TABLE = "model_live_streams";

type Row = SbRow & {
  model?: string[] | null;
  date?: string | null;
  planned_start?: string | null;
  planned_end?: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
  platform?: string | null;
  status?: string | null;
  details?: string | null;
  details_en?: string | null;
  details_es?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

async function mapRow(row: Row): Promise<ModelLiveStreamRecord> {
  const model_id = (await sbFirstLinkedAirtableId("modelss", row.model)) ?? "";
  return {
    id: publicId(row),
    model_id,
    date: String(row.date ?? "").slice(0, 10),
    planned_start: row.planned_start ?? null,
    planned_end: row.planned_end ?? null,
    actual_start: row.actual_start ?? null,
    actual_end: row.actual_end ?? null,
    platform: row.platform ?? "",
    status: row.status ?? "",
    details: row.details ?? "",
    details_en: row.details_en ?? null,
    details_es: row.details_es ?? null,
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
  };
}

export function isActiveLiveStreamRecord(
  r: Pick<ModelLiveStreamRecord, "status" | "actual_end">
): boolean {
  if (r.actual_end) return false;
  const st = (r.status ?? "").trim().toLowerCase();
  return st === "live" || st === "in_progress";
}

export async function listModelLiveStreams(modelId: string): Promise<ModelLiveStreamRecord[]> {
  if (!modelId) return [];
  const all = await listAllModelLiveStreamsInRange();
  return all
    .filter((r) => r.model_id === modelId)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.planned_start ?? "").localeCompare(b.planned_start ?? "")
    );
}

export async function listAllModelLiveStreamsInRange(opts?: {
  fromDate?: string;
  toDate?: string;
}): Promise<ModelLiveStreamRecord[]> {
  const rows = await sbSelectAll<Row>(TABLE);
  let mapped = await Promise.all(rows.map(mapRow));
  if (opts?.fromDate) mapped = mapped.filter((r) => r.date >= opts.fromDate!);
  if (opts?.toDate) mapped = mapped.filter((r) => r.date <= opts.toDate!);
  mapped.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.planned_start ?? "").localeCompare(b.planned_start ?? "")
  );
  return mapped;
}

export async function getModelLiveStreamById(id: string): Promise<ModelLiveStreamRecord | null> {
  const row = await sbSelectByPublicId<Row>(TABLE, id);
  if (!row) return null;
  return mapRow(row);
}

export async function getActiveLiveStreamForModel(
  modelId: string
): Promise<ModelLiveStreamRecord | null> {
  if (!modelId) return null;
  const all = await listAllModelLiveStreamsInRange();
  return all.find((r) => r.model_id === modelId && isActiveLiveStreamRecord(r)) ?? null;
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
  const model = await requireSbUuids("modelss", [input.model_id], "model");
  const inserted = await sbInsert<Row>(TABLE, {
    model,
    date: input.date,
    planned_start: input.planned_start ?? null,
    planned_end: input.planned_end ?? null,
    actual_start: input.actual_start ?? null,
    actual_end: input.actual_end ?? null,
    platform: input.platform,
    status: input.status ?? "scheduled",
    details: input.details ?? "",
    details_en: input.details_en ?? null,
    details_es: input.details_es ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  const row = await mapRow(inserted);
  if (isActiveLiveStreamRecord(row)) {
    const verify = await getActiveLiveStreamForModel(input.model_id).catch(() => null);
    if (!verify) {
      console.warn(
        "[model-live-streams] create succeeded but getActiveLiveStreamForModel returned null",
        { model_id: input.model_id, live_id: row.id, status: row.status }
      );
    }
  }
  return row;
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
  const updated = await sbUpdateByPublicId<Row>(TABLE, id, {
    ...patch,
    updated_at: new Date().toISOString(),
  });
  return mapRow(updated);
}

export async function getLiveStreams(modelId: string): Promise<ModelLiveStreamRecord[]> {
  return listModelLiveStreams(modelId);
}
