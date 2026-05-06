"use server";

import { listAllRecords, type AirtableRecord } from "@/lib/airtable-server";
import { firstLinkedId } from "@/lib/airtable-linked";
import type { ModelScheduleItem, ModelScheduleItemType } from "@/types";

const TABLE = "model_schedule";

type Fields = {
  model_id?: string | string[];
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
    "script", "mass_message", "live_stream", "custom", "content_shoot", "promo", "meeting", "rest", "other",
  ];
  return allowed.includes(v as ModelScheduleItemType) ? (v as ModelScheduleItemType) : "other";
}

function mapRecord(rec: AirtableRecord<Fields>): ModelScheduleItem {
  const f = rec.fields;
  return {
    id: rec.id,
    model_id: firstLinkedId(f.model_id) ?? "",
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

export async function getSchedule(modelId: string): Promise<ModelScheduleItem[]> {
  return listModelScheduleItems(modelId);
}
