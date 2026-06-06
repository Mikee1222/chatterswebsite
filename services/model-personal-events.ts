import { createRecord, deleteRecord, listAllRecords, type AirtableRecord } from "@/lib/airtable-server";
import { firstLinkedId } from "@/lib/airtable-linked";
import type { ModelPersonalEvent, ModelPersonalEventType } from "@/types";

const TABLE = "model_personal_events";

type Fields = {
  event_id?: string;
  model_id?: string | string[];
  model_user_id?: string;
  event_type?: string;
  custom_label?: string;
  event_date?: string;
  event_time?: string;
  notes?: string;
  created_at?: string;
  reminder_sent?: boolean;
};

const EVENT_TYPES: ModelPersonalEventType[] = ["nails", "lashes", "hairdresser", "surgery", "fillers", "custom"];

function asEventType(raw: unknown): ModelPersonalEventType {
  const v = typeof raw === "string" ? raw.trim() : "";
  return EVENT_TYPES.includes(v as ModelPersonalEventType) ? (v as ModelPersonalEventType) : "custom";
}

function mapRecord(rec: AirtableRecord<Fields>): ModelPersonalEvent {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    event_id: String(f.event_id ?? "").trim(),
    model_id: firstLinkedId(f.model_id) ?? "",
    model_user_id: String(f.model_user_id ?? "").trim(),
    event_type: asEventType(f.event_type),
    custom_label: String(f.custom_label ?? "").trim(),
    event_date: String(f.event_date ?? "").trim().slice(0, 10),
    event_time: String(f.event_time ?? "").trim() || null,
    notes: String(f.notes ?? "").trim(),
    created_at: String(f.created_at ?? "").trim(),
    reminder_sent: f.reminder_sent === true,
  };
}

export function personalEventLabel(event: Pick<ModelPersonalEvent, "event_type" | "custom_label">): string {
  if (event.event_type === "custom") return event.custom_label.trim() || "Custom event";
  if (event.event_type === "hairdresser") return "Hairdresser";
  return event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1);
}

export function personalEventEmoji(eventType: ModelPersonalEventType): string {
  if (eventType === "nails") return "";
  if (eventType === "lashes") return "";
  if (eventType === "hairdresser") return "";
  if (eventType === "surgery") return "";
  if (eventType === "fillers") return "";
  return "⭐";
}

export async function listModelPersonalEventsForModel(modelRecordId: string): Promise<ModelPersonalEvent[]> {
  const id = modelRecordId?.trim();
  if (!id) return [];
  const records = await listAllRecords<Fields>(TABLE, { sort: [{ field: "event_date", direction: "asc" }] });
  return records.map(mapRecord).filter((row) => row.model_id === id);
}

export async function listModelPersonalEventsInDateRange(fromYmd: string, toYmd: string): Promise<ModelPersonalEvent[]> {
  const from = fromYmd.trim().slice(0, 10);
  const to = toYmd.trim().slice(0, 10);
  if (!from || !to) return [];
  const records = await listAllRecords<Fields>(TABLE, { sort: [{ field: "event_date", direction: "asc" }] });
  return records
    .map(mapRecord)
    .filter((row) => row.event_date && row.event_date >= from && row.event_date <= to);
}

export async function createModelPersonalEvent(input: {
  model_id: string;
  model_user_id: string;
  event_type: ModelPersonalEventType;
  custom_label?: string;
  event_date: string;
  event_time?: string;
  notes?: string;
}): Promise<ModelPersonalEvent> {
  const now = new Date().toISOString();
  const rec = await createRecord<Fields>(TABLE, {
    event_id: `mpe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    model_id: [input.model_id],
    model_user_id: input.model_user_id,
    event_type: input.event_type,
    custom_label: input.custom_label?.trim() || "",
    event_date: input.event_date.trim().slice(0, 10),
    event_time: input.event_time?.trim() || "",
    notes: input.notes?.trim() || "",
    created_at: now,
    reminder_sent: false,
  } as Fields);
  return mapRecord(rec as AirtableRecord<Fields>);
}

export async function deleteModelPersonalEvent(recordId: string): Promise<void> {
  await deleteRecord(TABLE, recordId);
}
