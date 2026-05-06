"use server";

import { listAllRecords, createRecord, type AirtableRecord } from "@/lib/airtable-server";
import { firstLinkedId } from "@/lib/airtable-linked";
import type { ModelScheduleItem, ModelScheduleItemType } from "@/types";

const TABLE = "model_schedule";

type Fields = {
  /** multipleRecordLinks → modelss (canonical). Never write `model_id` — Airtable rejects it on link cols. */
  model?: string | string[];
  /** Legacy read-only mirror if base still exposes old name */
  model_id?: string | string[];
  model_name?: string;
  chatter?: string | string[];
  created_by?: string | string[];
  title?: string;
  item_type?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  priority?: string;
  status?: string;
  details?: string;
  details_en?: string;
  details_es?: string;
  instructions?: string;
  instructions_en?: string;
  instructions_es?: string;
  linked_custom_request?: string | string[];
  created_at?: string;
  updated_at?: string;
};

function asItemType(raw: unknown): ModelScheduleItemType {
  const v = typeof raw === "string" ? raw : "";
  const allowed: ModelScheduleItemType[] = [
    "script",
    "mass_message",
    "live_stream",
    "custom",
    "content_shoot",
    "promo",
    "meeting",
    "rest",
    "time_off",
    "other",
  ];
  return allowed.includes(v as ModelScheduleItemType) ? (v as ModelScheduleItemType) : "other";
}

function mapRecord(rec: AirtableRecord<Fields>): ModelScheduleItem {
  const f = rec.fields;
  return {
    id: rec.id,
    model_id: firstLinkedId(f.model ?? f.model_id) ?? "",
    title: f.title ?? "",
    item_type: asItemType(f.item_type),
    date: (f.date ?? "").slice(0, 10),
    start_time: f.start_time ?? null,
    end_time: f.end_time ?? null,
    duration_minutes: typeof f.duration_minutes === "number" ? f.duration_minutes : null,
    priority: f.priority ?? "",
    status: f.status ?? "",
    details: f.details ?? "",
    details_en: f.details_en ?? null,
    details_es: f.details_es ?? null,
    instructions: f.instructions ?? "",
    instructions_en: f.instructions_en ?? null,
    instructions_es: f.instructions_es ?? null,
    linked_custom_request_id: firstLinkedId(f.linked_custom_request) ?? null,
    created_at: f.created_at ?? "",
    updated_at: f.updated_at ?? "",
  };
}

export async function listModelScheduleItems(
  modelId: string,
  opts?: { fromDate?: string; toDate?: string }
): Promise<ModelScheduleItem[]> {
  if (!modelId) return [];
  const records = await listAllRecords<Fields>(TABLE, { sort: [{ field: "date", direction: "asc" }] });
  let rows = records.map(mapRecord).filter((r) => r.model_id === modelId);
  if (opts?.fromDate) rows = rows.filter((r) => r.date >= opts.fromDate!);
  if (opts?.toDate) rows = rows.filter((r) => r.date <= opts.toDate!);
  rows.sort((a, b) => a.date.localeCompare(b.date) || (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  return rows;
}

/** All models; optional inclusive date bounds (YYYY-MM-DD). */
export async function listAllModelScheduleItemsInRange(opts?: {
  fromDate?: string;
  toDate?: string;
}): Promise<ModelScheduleItem[]> {
  const records = await listAllRecords<Fields>(TABLE, { sort: [{ field: "date", direction: "asc" }] });
  let rows = records.map(mapRecord);
  if (opts?.fromDate) rows = rows.filter((r) => r.date >= opts.fromDate!);
  if (opts?.toDate) rows = rows.filter((r) => r.date <= opts.toDate!);
  rows.sort((a, b) => a.date.localeCompare(b.date) || (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  return rows;
}

export async function getSchedule(modelId: string): Promise<ModelScheduleItem[]> {
  return listModelScheduleItems(modelId);
}

export type CreateModelScheduleCustomInput = {
  model_record_id: string;
  custom_request_id: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  details: string;
  /** Optional: `modelss` display snapshot on `model_schedule` */
  model_name?: string;
  /** Optional: link → users (chatter) */
  chatter_record_id?: string | null;
  /** Optional: link → users (actor who created the row) */
  created_by_record_id?: string | null;
};

/** One calendar row for a custom, linked back to `custom_requests`. */
export async function createModelScheduleItemForCustom(
  input: CreateModelScheduleCustomInput
): Promise<ModelScheduleItem> {
  const date = input.date.trim().slice(0, 10);
  const payload: Record<string, unknown> = {
    model: [input.model_record_id],
    title: input.title.trim() || "Custom",
    item_type: "custom",
    date,
    start_time: input.start_time?.trim() || "",
    end_time: input.end_time?.trim() || "",
    details: input.details.trim(),
    linked_custom_request: [input.custom_request_id],
    status: "scheduled",
  };
  const mn = input.model_name?.trim();
  if (mn) payload.model_name = mn;
  const chatter = input.chatter_record_id?.trim();
  if (chatter) payload.chatter = [chatter];
  const creator = input.created_by_record_id?.trim();
  if (creator) payload.created_by = [creator];
  const rec = await createRecord<Fields>(TABLE, payload as Fields);
  return mapRecord(rec as AirtableRecord<Fields>);
}

/** Single schedule row for a multi-day absence (`date` = first day; range in `details`). */
export async function createModelScheduleTimeOff(input: {
  model_record_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  model_name?: string;
  created_by_record_id?: string | null;
}): Promise<ModelScheduleItem> {
  const start = input.start_date.trim().slice(0, 10);
  const end = input.end_date.trim().slice(0, 10);
  const reason = input.reason.trim() || "Time off";
  const details = `${reason}\nThrough ${end}`;
  const payload: Record<string, unknown> = {
    model: [input.model_record_id],
    title: "Time off",
    item_type: "time_off",
    date: start,
    details,
    status: "scheduled",
  };
  const mn = input.model_name?.trim();
  if (mn) payload.model_name = mn;
  const creator = input.created_by_record_id?.trim();
  if (creator) payload.created_by = [creator];
  const rec = await createRecord<Fields>(TABLE, payload as Fields);
  return mapRecord(rec as AirtableRecord<Fields>);
}
