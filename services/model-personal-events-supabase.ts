/**
 * Supabase backend for services/model-personal-events.ts
 */
import {
  sbResolveUuidToAirtableMap,
  firstMappedLinkedId,
  publicId, sbDeleteByPublicId, sbInsert,
  sbSelectAll, requireSbUuids, type SbRow,
} from "@/lib/supabase-data";
import type { ModelPersonalEvent, ModelPersonalEventType } from "@/types";

const TABLE = "model_personal_events";
const EVENT_TYPES: ModelPersonalEventType[] = ["nails","lashes","hairdresser","surgery","fillers","custom"];

type Row = SbRow & {
  event_id?: string | null; model_id?: string[] | null; model_user_id?: string | null;
  event_type?: string | null; custom_label?: string | null; event_date?: string | null;
  event_time?: string | null; notes?: string | null; created_at?: string | null;
  reminder_sent?: boolean | null;
};

function asEventType(raw: unknown): ModelPersonalEventType {
  const v = typeof raw === "string" ? raw.trim() : "";
  return EVENT_TYPES.includes(v as ModelPersonalEventType) ? (v as ModelPersonalEventType) : "custom";
}

function mapRowSync(row: Row, modelAt: Map<string, string>): ModelPersonalEvent {
  return {
    id: publicId(row),
    event_id: String(row.event_id ?? "").trim(),
    model_id: firstMappedLinkedId(row.model_id, modelAt),
    model_user_id: String(row.model_user_id ?? "").trim(),
    event_type: asEventType(row.event_type),
    custom_label: String(row.custom_label ?? "").trim(),
    event_date: String(row.event_date ?? "").trim().slice(0, 10),
    event_time: String(row.event_time ?? "").trim() || null,
    notes: String(row.notes ?? "").trim(),
    created_at: String(row.created_at ?? "").trim(),
    reminder_sent: row.reminder_sent === true,
  };
}

async function mapRows(rows: Row[]): Promise<ModelPersonalEvent[]> {
  if (!rows.length) return [];
  const modelAt = await sbResolveUuidToAirtableMap(
    "modelss",
    rows.map((r) => r.model_id)
  );
  return rows.map((r) => mapRowSync(r, modelAt));
}

async function mapRow(row: Row): Promise<ModelPersonalEvent> {
  const [mapped] = await mapRows([row]);
  return mapped!;
}

export async function listModelPersonalEventsForModel(modelRecordId: string): Promise<ModelPersonalEvent[]> {
  const id = modelRecordId?.trim();
  if (!id) return [];
  const rows = await sbSelectAll<Row>(TABLE);
  const mapped = await mapRows(rows);
  return mapped.filter((r) => r.model_id === id).sort((a,b) => a.event_date.localeCompare(b.event_date));
}

export async function listModelPersonalEventsInDateRange(fromYmd: string, toYmd: string): Promise<ModelPersonalEvent[]> {
  const from = fromYmd.trim().slice(0, 10);
  const to = toYmd.trim().slice(0, 10);
  if (!from || !to) return [];
  const rows = await sbSelectAll<Row>(TABLE);
  const mapped = await mapRows(rows);
  return mapped.filter((r) => r.event_date && r.event_date >= from && r.event_date <= to)
    .sort((a,b) => a.event_date.localeCompare(b.event_date));
}

export async function createModelPersonalEvent(input: {
  model_id: string; model_user_id: string; event_type: ModelPersonalEventType;
  custom_label?: string; event_date: string; event_time?: string; notes?: string;
}): Promise<ModelPersonalEvent> {
  const now = new Date().toISOString();
  const modelUuids = await requireSbUuids("modelss", [input.model_id], "model");
  const row = await sbInsert<Row>(TABLE, {
    event_id: `mpe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    model_id: modelUuids,
    model_user_id: input.model_user_id,
    event_type: input.event_type,
    custom_label: input.custom_label?.trim() || "",
    event_date: input.event_date.trim().slice(0, 10),
    event_time: input.event_time?.trim() || "",
    notes: input.notes?.trim() || "",
    created_at: now,
    reminder_sent: false,
  });
  return mapRow(row);
}

export async function deleteModelPersonalEvent(recordId: string): Promise<void> {
  await sbDeleteByPublicId(TABLE, recordId);
}
