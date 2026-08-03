/**
 * Supabase backend for services/model-time-off-requests.ts
 */
import {
  publicId, sbDeleteByPublicId, sbFirstLinkedAirtableId, sbInsert,
  sbSelectAll, sbSelectByPublicId, requireSbUuids, type SbRow,
} from "@/lib/supabase-data";
import type { ModelTimeOffRequest } from "@/types";

const TABLE = "model_time_off_requests";
type Row = SbRow & {
  request_id?: string | null; model?: string[] | null; model_id?: string | null;
  model_name?: string | null; start_date?: string | null; end_date?: string | null;
  reason?: string | null; status?: string | null; created_at?: string | null;
};

function sliceYmd(raw: unknown): string {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (s.includes("T")) {
    try {
      const d = new Date(s);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    } catch { /* ignore */ }
  }
  return "";
}

function rangeOverlaps(start: string, end: string, fromYmd: string, toYmd: string): boolean {
  if (!start || !end) return false;
  return start <= toYmd && end >= fromYmd;
}

async function mapRow(row: Row): Promise<ModelTimeOffRequest> {
  return {
    id: publicId(row),
    request_id: row.request_id ?? "",
    model_id: (await sbFirstLinkedAirtableId("modelss", row.model)) || String(row.model_id ?? ""),
    model_name: row.model_name ?? "",
    start_date: sliceYmd(row.start_date),
    end_date: sliceYmd(row.end_date),
    reason: row.reason ?? "",
    status: row.status ?? "",
    created_at: row.created_at ?? "",
  };
}

export async function getModelTimeOffRequestsForRange(
  modelId: string, fromYmd: string, toYmd: string
): Promise<ModelTimeOffRequest[]> {
  if (!modelId || !fromYmd || !toYmd) return [];
  try {
    const rows = await sbSelectAll<Row>(TABLE);
    const mapped = await Promise.all(rows.map(mapRow));
    return mapped.filter((r) => r.model_id === modelId && rangeOverlaps(r.start_date, r.end_date, fromYmd, toYmd));
  } catch (error) {
    console.warn("[model-time-off-requests] supabase fallback empty", error);
    return [];
  }
}

export async function createModelTimeOffRequest(input: {
  model_id: string; model_name: string; start_date: string; end_date: string; reason: string;
}): Promise<ModelTimeOffRequest> {
  const modelUuids = await requireSbUuids("modelss", [input.model_id], "model");
  const row = await sbInsert<Row>(TABLE, {
    request_id: `timeoff_model_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    model: modelUuids,
    model_name: input.model_name,
    start_date: input.start_date.slice(0, 10),
    end_date: input.end_date.slice(0, 10),
    reason: input.reason.trim(),
    status: "submitted",
  });
  return mapRow(row);
}

export async function deleteModelTimeOffRequestForModel(recordId: string, modelRecordId: string): Promise<boolean> {
  const id = recordId?.trim();
  if (!id || !modelRecordId?.trim()) return false;
  try {
    const row = await sbSelectByPublicId<Row>(TABLE, id);
    if (!row) return false;
    const mapped = await mapRow(row);
    if (mapped.model_id !== modelRecordId) return false;
    const st = (mapped.status ?? "").trim().toLowerCase();
    if (st !== "pending" && st !== "submitted") return false;
    await sbDeleteByPublicId(TABLE, id);
    return true;
  } catch { return false; }
}
