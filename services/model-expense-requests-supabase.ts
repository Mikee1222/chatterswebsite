/**
 * Supabase backend for services/model-expense-requests.ts
 */
import {
  sbResolveUuidToAirtableMap,
  firstMappedLinkedId,
  publicId, sbInsert, sbSelectAll,
  sbUpdateByPublicId, requireSbUuids, type SbRow,
} from "@/lib/supabase-data";
import type { ModelExpenseRequest, ModelExpenseRequestStatus, ModelExpenseRequestType } from "@/types";

const TABLE = "model_expense_requests";
const TYPES: ModelExpenseRequestType[] = ["airbnb", "other"];
const STATUSES: ModelExpenseRequestStatus[] = ["pending", "approved", "rejected"];

type Row = SbRow & {
  request_id?: string | null; model_id?: string[] | null; model_user_id?: string | null;
  va_content_assignment_id?: string | null; assignment_title?: string | null;
  type?: string | null; airbnb_link?: string | null; notes?: string | null;
  status?: string | null; admin_notes?: string | null; created_at?: string | null;
  updated_at?: string | null;
};

function asType(raw: unknown): ModelExpenseRequestType {
  const v = typeof raw === "string" ? raw.trim() : "";
  return TYPES.includes(v as ModelExpenseRequestType) ? (v as ModelExpenseRequestType) : "other";
}
function asStatus(raw: unknown): ModelExpenseRequestStatus {
  const v = typeof raw === "string" ? raw.trim() : "";
  return STATUSES.includes(v as ModelExpenseRequestStatus) ? (v as ModelExpenseRequestStatus) : "pending";
}

function mapRowSync(row: Row, modelAt: Map<string, string>): ModelExpenseRequest {
  return {
    id: publicId(row),
    request_id: String(row.request_id ?? "").trim(),
    model_id: firstMappedLinkedId(row.model_id, modelAt),
    model_user_id: String(row.model_user_id ?? "").trim(),
    va_content_assignment_id: String(row.va_content_assignment_id ?? "").trim(),
    assignment_title: String(row.assignment_title ?? "").trim(),
    type: asType(row.type),
    airbnb_link: String(row.airbnb_link ?? "").trim(),
    notes: String(row.notes ?? "").trim(),
    status: asStatus(row.status),
    admin_notes: String(row.admin_notes ?? "").trim(),
    created_at: String(row.created_at ?? "").trim(),
    updated_at: String(row.updated_at ?? "").trim(),
  };
}

async function mapRows(rows: Row[]): Promise<ModelExpenseRequest[]> {
  if (!rows.length) return [];
  const modelAt = await sbResolveUuidToAirtableMap(
    "modelss",
    rows.map((r) => r.model_id)
  );
  return rows.map((r) => mapRowSync(r, modelAt));
}

async function mapRow(row: Row): Promise<ModelExpenseRequest> {
  const [mapped] = await mapRows([row]);
  return mapped!;
}

export async function listModelExpenseRequestsForModel(modelRecordId: string): Promise<ModelExpenseRequest[]> {
  const id = modelRecordId?.trim();
  if (!id) return [];
  const all = await listAllModelExpenseRequests();
  return all.filter((r) => r.model_id === id);
}

export async function listAllModelExpenseRequests(): Promise<ModelExpenseRequest[]> {
  const rows = await sbSelectAll<Row>(TABLE);
  const mapped = await mapRows(rows);
  return mapped.sort((a,b) => b.created_at.localeCompare(a.created_at));
}

export async function createModelExpenseRequest(input: {
  model_id: string; model_user_id: string; va_content_assignment_id: string;
  assignment_title: string; type: ModelExpenseRequestType; airbnb_link: string; notes?: string;
}): Promise<ModelExpenseRequest> {
  const now = new Date().toISOString();
  const modelUuids = await requireSbUuids("modelss", [input.model_id], "model");
  const row = await sbInsert<Row>(TABLE, {
    request_id: `mer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    model_id: modelUuids,
    model_user_id: input.model_user_id,
    va_content_assignment_id: input.va_content_assignment_id,
    assignment_title: input.assignment_title.trim(),
    type: input.type,
    airbnb_link: input.airbnb_link.trim(),
    notes: input.notes?.trim() || "",
    status: "pending",
    admin_notes: "",
    created_at: now,
    updated_at: now,
  });
  return mapRow(row);
}

export async function updateModelExpenseRequest(
  recordId: string,
  input: Partial<Pick<ModelExpenseRequest, "status" | "admin_notes">>
): Promise<ModelExpenseRequest> {
  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.status !== undefined) fields.status = input.status;
  if (input.admin_notes !== undefined) fields.admin_notes = input.admin_notes;
  const row = await sbUpdateByPublicId<Row>(TABLE, recordId, fields);
  return mapRow(row);
}
