"use server";

import { listAllRecords, createRecord, getRecord, deleteRecord, type AirtableRecord } from "@/lib/airtable-server";
import { isSupabaseBackend } from "@/lib/data-backend";
import { firstLinkedId } from "@/lib/airtable-linked";
import type { ModelTimeOffRequest } from "@/types";

const TABLE = "model_time_off_requests";

type Fields = {
  request_id?: string;
  model?: string | string[];
  model_id?: string | string[];
  model_name?: string;
  start_date?: string;
  end_date?: string;
  reason?: string;
  status?: string;
  created_at?: string;
};

function sliceYmd(raw: unknown): string {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (s.includes("T")) {
    try {
      const d = new Date(s);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    } catch {
      /* ignore */
    }
  }
  return "";
}

function mapRecord(rec: AirtableRecord<Fields>): ModelTimeOffRequest {
  const f = rec.fields;
  return {
    id: rec.id,
    request_id: f.request_id ?? "",
    model_id: firstLinkedId(f.model ?? f.model_id) ?? "",
    model_name: f.model_name ?? "",
    start_date: sliceYmd(f.start_date),
    end_date: sliceYmd(f.end_date),
    reason: f.reason ?? "",
    status: f.status ?? "",
    created_at: f.created_at ?? "",
  };
}

/** True when [start_date, end_date] overlaps [fromYmd, toYmd] inclusive. */
function rangeOverlaps(start: string, end: string, fromYmd: string, toYmd: string): boolean {
  if (!start || !end) return false;
  return start <= toYmd && end >= fromYmd;
}

export async function getModelTimeOffRequestsForRange(
  modelId: string,
  fromYmd: string,
  toYmd: string
): Promise<ModelTimeOffRequest[]> {
  if (isSupabaseBackend()) return (await import("./model-time-off-requests-supabase")).getModelTimeOffRequestsForRange(modelId, fromYmd, toYmd);
  if (!modelId || !fromYmd || !toYmd) return [];
  let records: AirtableRecord<Fields>[] = [];
  try {
    records = await listAllRecords<Fields>(TABLE, { sort: [{ field: "start_date", direction: "desc" }] });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[model-time-off-requests] returning empty fallback", { table: TABLE, message });
    return [];
  }
  return records
    .map(mapRecord)
    .filter((r) => r.model_id === modelId && rangeOverlaps(r.start_date, r.end_date, fromYmd, toYmd));
}

export async function createModelTimeOffRequest(input: {
  model_id: string;
  model_name: string;
  start_date: string;
  end_date: string;
  reason: string;
}): Promise<ModelTimeOffRequest> {
  if (isSupabaseBackend()) return (await import("./model-time-off-requests-supabase")).createModelTimeOffRequest(input);
  const rec = await createRecord<Fields>(TABLE, {
    request_id: `timeoff_model_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    model: [input.model_id],
    model_name: input.model_name,
    start_date: input.start_date.slice(0, 10),
    end_date: input.end_date.slice(0, 10),
    reason: input.reason.trim(),
    status: "submitted",
  });
  return mapRecord(rec as AirtableRecord<Fields>);
}

/** Delete a pending/submitted time-off request owned by this model. */
export async function deleteModelTimeOffRequestForModel(recordId: string, modelRecordId: string): Promise<boolean> {
  if (isSupabaseBackend()) return (await import("./model-time-off-requests-supabase")).deleteModelTimeOffRequestForModel(recordId, modelRecordId);
  const id = recordId?.trim();
  if (!id || !modelRecordId?.trim()) return false;
  try {
    const rec = await getRecord<Fields>(TABLE, id);
    const row = mapRecord(rec as AirtableRecord<Fields>);
    if (row.model_id !== modelRecordId) return false;
    const st = (row.status ?? "").trim().toLowerCase();
    if (st !== "pending" && st !== "submitted") return false;
    await deleteRecord(TABLE, id);
    return true;
  } catch {
    return false;
  }
}
