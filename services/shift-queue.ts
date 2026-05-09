import { listAllRecords, createRecord, updateRecord, deleteRecord, type AirtableRecord } from "@/lib/airtable-server";
import type { ShiftQueueEntryApi, ShiftQueueStatus } from "@/types";

const SHIFT_QUEUE_TABLE = "shift_queue";

type ShiftQueueFields = {
  queue_id?: string;
  chatter_id?: string;
  chatter_name?: string;
  selected_model_ids?: string;
  selected_model_names?: string;
  status?: string;
  waiting_for_shift_id?: string;
  waiting_for_chatter_name?: string;
  created_at?: string;
  started_at?: string;
  cancelled_at?: string;
};

function escapeFormulaString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function normalizeQueueStatus(raw: string | undefined): ShiftQueueStatus {
  const v = String(raw ?? "waiting")
    .trim()
    .toLowerCase();
  if (v === "started") return "started";
  if (v === "cancelled" || v === "canceled") return "cancelled";
  if (v === "expired") return "expired";
  return "waiting";
}

function mapShiftQueueRecord(rec: AirtableRecord<ShiftQueueFields>): ShiftQueueEntryApi {
  const f = rec.fields;
  let selected_model_ids: string[] = [];
  let selected_model_names: string[] = [];
  try {
    selected_model_ids = JSON.parse(typeof f.selected_model_ids === "string" ? f.selected_model_ids : "[]");
    if (!Array.isArray(selected_model_ids)) selected_model_ids = [];
  } catch {
    selected_model_ids = [];
  }
  try {
    selected_model_names = JSON.parse(typeof f.selected_model_names === "string" ? f.selected_model_names : "[]");
    if (!Array.isArray(selected_model_names)) selected_model_names = [];
  } catch {
    selected_model_names = [];
  }
  return {
    id: rec.id,
    queue_id: String(f.queue_id ?? ""),
    chatter_id: String(f.chatter_id ?? ""),
    chatter_name: String(f.chatter_name ?? ""),
    selected_model_ids,
    selected_model_names,
    status: normalizeQueueStatus(f.status),
    waiting_for_shift_id: String(f.waiting_for_shift_id ?? ""),
    waiting_for_chatter_name: String(f.waiting_for_chatter_name ?? ""),
    created_at: f.created_at ?? null,
    started_at: f.started_at ?? null,
    cancelled_at: f.cancelled_at ?? null,
  };
}

/** FIFO: waiting rows for a completed shift (auto-start queue). */
export async function listShiftQueueWaitingForShift(shiftId: string): Promise<ShiftQueueEntryApi[]> {
  const sid = escapeFormulaString(shiftId.trim());
  const formula = `AND({waiting_for_shift_id} = "${sid}", {status} = "waiting")`;
  const records = await listAllRecords<ShiftQueueFields>(SHIFT_QUEUE_TABLE, {
    filterByFormula: formula,
    sort: [{ field: "created_at", direction: "asc" }],
    _caller: "shiftQueue.listWaitingForShift",
  });
  return records.map(mapShiftQueueRecord);
}

export async function getShiftQueueWaitingForChatter(chatterId: string): Promise<ShiftQueueEntryApi | null> {
  const cid = escapeFormulaString(chatterId.trim());
  const formula = `AND({chatter_id} = "${cid}", {status} = "waiting")`;
  const records = await listAllRecords<ShiftQueueFields>(SHIFT_QUEUE_TABLE, {
    filterByFormula: formula,
    pageSize: 5,
    _caller: "shiftQueue.getWaitingForChatter",
  });
  return records.length ? mapShiftQueueRecord(records[0]) : null;
}

/** All waiting rows (admin live view). */
export async function listAllShiftQueueWaiting(): Promise<ShiftQueueEntryApi[]> {
  const records = await listAllRecords<ShiftQueueFields>(SHIFT_QUEUE_TABLE, {
    filterByFormula: `{status} = "waiting"`,
    sort: [{ field: "created_at", direction: "asc" }],
    _caller: "shiftQueue.listAllWaiting",
  });
  return records.map(mapShiftQueueRecord);
}

export async function updateShiftQueueRecord(
  recordId: string,
  fields: Partial<{
    status: ShiftQueueStatus;
    started_at: string;
    cancelled_at: string;
  }>
): Promise<void> {
  await updateRecord(SHIFT_QUEUE_TABLE, recordId, fields as Record<string, unknown>);
}

export async function deleteShiftQueueRecord(recordId: string): Promise<void> {
  await deleteRecord(SHIFT_QUEUE_TABLE, recordId);
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
}): Promise<{ id: string }> {
  const rec = await createRecord(SHIFT_QUEUE_TABLE, payload as Record<string, unknown>);
  return { id: rec.id };
}
