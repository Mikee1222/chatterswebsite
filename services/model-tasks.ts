"use server";

import { listAllRecords, type AirtableRecord } from "@/lib/airtable-server";
import { firstLinkedId } from "@/lib/airtable-linked";
import type { ModelTaskRecord, ModelTaskStatus } from "@/types";

const TABLE = "model_tasks";

type Fields = {
  /** Link → modelss; some bases use `model_id` as the link column name. */
  model?: string | string[];
  model_id?: string | string[];
  title?: string;
  type?: string;
  required?: boolean;
  status?: string;
  description?: string;
  description_en?: string;
  description_es?: string;
  linked_schedule_item?: string | string[];
  completion_notes?: string;
  created_at?: string;
  updated_at?: string;
};

function parseStatus(raw: unknown): ModelTaskStatus {
  const s = typeof raw === "string" ? raw : "";
  if (s === "pending" || s === "done" || s === "skipped" || s === "blocked") return s;
  return "pending";
}

function mapRecord(rec: AirtableRecord<Fields>): ModelTaskRecord {
  const f = rec.fields;
  return {
    id: rec.id,
    model_id: firstLinkedId(f.model ?? f.model_id) ?? "",
    title: f.title ?? "",
    type: f.type ?? "",
    required: Boolean(f.required),
    status: parseStatus(f.status),
    description: f.description ?? "",
    description_en: f.description_en ?? null,
    description_es: f.description_es ?? null,
    linked_schedule_item_id: firstLinkedId(f.linked_schedule_item) ?? null,
    completion_notes: f.completion_notes ?? null,
    created_at: f.created_at ?? "",
    updated_at: f.updated_at ?? "",
  };
}

export async function listModelTasks(modelId: string): Promise<ModelTaskRecord[]> {
  if (!modelId) return [];
  const records = await listAllRecords<Fields>(TABLE, { sort: [{ field: "created_at", direction: "desc" }] });
  return records.map(mapRecord).filter((r) => r.model_id === modelId);
}

export async function getTasks(modelId: string): Promise<ModelTaskRecord[]> {
  return listModelTasks(modelId);
}
