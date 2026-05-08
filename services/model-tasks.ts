"use server";

import { listAllRecords, type AirtableRecord } from "@/lib/airtable-server";
import { firstLinkedId } from "@/lib/airtable-linked";
import type { ModelTaskRecord, ModelTaskStatus } from "@/types";

const TABLE = "model_tasks";

type Fields = {
  /** Link → modelss; some bases use `model_id` as the link column name. */
  model?: string | string[];
  model_id?: string | string[];
  task_id?: string;
  /** Airtable single-select column (canonical). Legacy: `type`. */
  task_type?: string;
  /** Legacy bases may still use `type`. */
  type?: string;
  title?: string;
  /** Canonical Airtable checkbox name. */
  is_required?: boolean;
  required?: boolean;
  /** Airtable single-select (canonical). Legacy: `status`. */
  task_status?: string;
  status?: string;
  description?: string;
  description_en?: string;
  description_es?: string;
  /** Canonical link field name from schema audit. */
  schedule_item?: string | string[];
  linked_schedule_item?: string | string[];
  date?: string;
  completion_notes?: string;
  sort_order?: number;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
};

function parseStatus(raw: unknown): ModelTaskStatus {
  const s = typeof raw === "string" ? raw : "";
  if (s === "pending" || s === "done" || s === "skipped" || s === "blocked") return s;
  return "pending";
}

function toDateOnlyYmd(raw: string | null | undefined): string | null {
  if (raw == null || String(raw).trim() === "") return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function mapRecord(rec: AirtableRecord<Fields>): ModelTaskRecord {
  const f = rec.fields;
  const typeRaw = f.task_type ?? f.type ?? "";
  const statusRaw = f.task_status ?? f.status;
  return {
    id: rec.id,
    model_id: firstLinkedId(f.model ?? f.model_id) ?? "",
    title: f.title ?? "",
    type: typeof typeRaw === "string" ? typeRaw : "",
    required: Boolean(f.is_required ?? f.required),
    status: parseStatus(statusRaw),
    description: f.description ?? "",
    description_en: f.description_en ?? null,
    description_es: f.description_es ?? null,
    linked_schedule_item_id: firstLinkedId(f.linked_schedule_item ?? f.schedule_item) ?? null,
    completion_notes: f.completion_notes ?? null,
    due_date: f.date ? toDateOnlyYmd(f.date) : null,
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
