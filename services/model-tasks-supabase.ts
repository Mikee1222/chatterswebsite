/**
 * Supabase backend for services/model-tasks.ts
 */
import {
  firstMappedLinkedId,
  publicId,
  sbResolveUuidToAirtableMap,
  sbSelectAll,
  type SbRow,
} from "@/lib/supabase-data";
import type { ModelTaskRecord, ModelTaskStatus } from "@/types";

const TABLE = "model_tasks";
type Row = SbRow & {
  model?: string[] | null; model_id?: string | null; title?: string | null;
  task_type?: string | null; type?: string | null; is_required?: boolean | null;
  required?: boolean | null; task_status?: string | null; status?: string | null;
  description?: string | null; description_en?: string | null; description_es?: string | null;
  schedule_item?: string[] | null; linked_schedule_item?: string[] | null;
  date?: string | null; completion_notes?: string | null; created_at?: string | null;
  updated_at?: string | null;
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

function mapRowSync(
  row: Row,
  modelAt: Map<string, string>,
  scheduleAt: Map<string, string>
): ModelTaskRecord {
  const typeRaw = row.task_type ?? row.type ?? "";
  const statusRaw = row.task_status ?? row.status;
  const scheduleLinked = row.linked_schedule_item ?? row.schedule_item;
  return {
    id: publicId(row),
    model_id: firstMappedLinkedId(row.model, modelAt) || String(row.model_id ?? ""),
    title: row.title ?? "",
    type: typeof typeRaw === "string" ? typeRaw : "",
    required: Boolean(row.is_required ?? row.required),
    status: parseStatus(statusRaw),
    description: row.description ?? "",
    description_en: row.description_en ?? null,
    description_es: row.description_es ?? null,
    linked_schedule_item_id: firstMappedLinkedId(scheduleLinked, scheduleAt) || null,
    completion_notes: row.completion_notes ?? null,
    due_date: row.date ? toDateOnlyYmd(row.date) : null,
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
  };
}

async function mapRows(rows: Row[]): Promise<ModelTaskRecord[]> {
  if (!rows.length) return [];
  const [modelAt, scheduleAt] = await Promise.all([
    sbResolveUuidToAirtableMap("modelss", rows.map((r) => r.model)),
    sbResolveUuidToAirtableMap(
      "model_schedule",
      rows.map((r) => r.linked_schedule_item ?? r.schedule_item)
    ),
  ]);
  return rows.map((r) => mapRowSync(r, modelAt, scheduleAt));
}

export async function listModelTasks(modelId: string): Promise<ModelTaskRecord[]> {
  if (!modelId) return [];
  const rows = await sbSelectAll<Row>(TABLE);
  const mapped = await mapRows(rows);
  return mapped.filter((r) => r.model_id === modelId)
    .sort((a,b) => b.created_at.localeCompare(a.created_at));
}

export async function getTasks(modelId: string): Promise<ModelTaskRecord[]> {
  return listModelTasks(modelId);
}
