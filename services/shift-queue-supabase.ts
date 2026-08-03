/**
 * Supabase backend for services/shift-queue.ts
 */
import {
  publicId,
  sbDeleteByPublicId,
  sbInsert,
  sbSelectAll,
  sbUpdateByPublicId,
  type SbRow,
} from "@/lib/supabase-data";
import type { ShiftQueueEntryApi, ShiftQueueStatus, ShiftQueueType } from "@/types";

const TABLE = "shift_queue";

type Row = SbRow & {
  queue_id?: string | null;
  chatter_id?: string | null;
  chatter_name?: string | null;
  selected_model_ids?: string | null;
  selected_model_names?: string | null;
  status?: string | null;
  queue_type?: string | null;
  target_shift_id?: string | null;
  waiting_for_shift_id?: string | null;
  waiting_for_chatter_name?: string | null;
  created_at?: string | null;
  started_at?: string | null;
  cancelled_at?: string | null;
};

function normalizeQueueType(raw: string | undefined | null): ShiftQueueType {
  const v = String(raw ?? "full_start").trim().toLowerCase();
  return v === "add_models" ? "add_models" : "full_start";
}

function normalizeQueueStatus(raw: string | undefined | null): ShiftQueueStatus {
  const v = String(raw ?? "waiting").trim().toLowerCase();
  if (v === "started") return "started";
  if (v === "cancelled" || v === "canceled") return "cancelled";
  if (v === "expired") return "expired";
  return "waiting";
}

function parseJsonArray(raw: unknown): string[] {
  try {
    const v = JSON.parse(typeof raw === "string" ? raw : "[]");
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function mapRow(row: Row): ShiftQueueEntryApi {
  return {
    id: publicId(row),
    queue_id: String(row.queue_id ?? ""),
    chatter_id: String(row.chatter_id ?? ""),
    chatter_name: String(row.chatter_name ?? ""),
    selected_model_ids: parseJsonArray(row.selected_model_ids),
    selected_model_names: parseJsonArray(row.selected_model_names),
    status: normalizeQueueStatus(row.status),
    queue_type: normalizeQueueType(row.queue_type),
    target_shift_id: String(row.target_shift_id ?? "").trim(),
    waiting_for_shift_id: String(row.waiting_for_shift_id ?? ""),
    waiting_for_chatter_name: String(row.waiting_for_chatter_name ?? ""),
    created_at: row.created_at ?? null,
    started_at: row.started_at ?? null,
    cancelled_at: row.cancelled_at ?? null,
  };
}

export async function listShiftQueueWaitingForShift(shiftId: string): Promise<ShiftQueueEntryApi[]> {
  const sid = shiftId.trim();
  const rows = await sbSelectAll<Row>(TABLE);
  return rows
    .map(mapRow)
    .filter((r) => r.waiting_for_shift_id === sid && r.status === "waiting")
    .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
}

export async function getShiftQueueWaitingForChatter(chatterId: string): Promise<ShiftQueueEntryApi | null> {
  const cid = chatterId.trim();
  const rows = await sbSelectAll<Row>(TABLE);
  const match = rows.map(mapRow).find((r) => r.chatter_id === cid && r.status === "waiting");
  return match ?? null;
}

export async function listAllShiftQueueWaiting(): Promise<ShiftQueueEntryApi[]> {
  const rows = await sbSelectAll<Row>(TABLE);
  return rows
    .map(mapRow)
    .filter((r) => r.status === "waiting")
    .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
}

export async function updateShiftQueueRecord(
  recordId: string,
  fields: Partial<{ status: ShiftQueueStatus; started_at: string; cancelled_at: string }>
): Promise<void> {
  await sbUpdateByPublicId(TABLE, recordId, fields as Record<string, unknown>);
}

export async function deleteShiftQueueRecord(recordId: string): Promise<void> {
  await sbDeleteByPublicId(TABLE, recordId);
}

export async function createShiftQueueEntry(payload: {
  queue_id: string;
  chatter_id: string;
  chatter_name: string;
  selected_model_ids: string;
  selected_model_names: string;
  status: "waiting";
  waiting_for_shift_id: string;
  waiting_for_chatter_name: string;
  created_at: string;
  queue_type?: ShiftQueueType;
  target_shift_id?: string;
}): Promise<{ id: string }> {
  const row = await sbInsert<Row>(TABLE, payload as Record<string, unknown>);
  return { id: publicId(row) };
}
