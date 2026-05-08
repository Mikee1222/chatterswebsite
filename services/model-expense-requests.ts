"use server";

import { createRecord, listAllRecords, updateRecord, type AirtableRecord } from "@/lib/airtable-server";
import { firstLinkedId } from "@/lib/airtable-linked";
import type { ModelExpenseRequest, ModelExpenseRequestStatus, ModelExpenseRequestType } from "@/types";

const TABLE = "model_expense_requests";

type Fields = {
  request_id?: string;
  model_id?: string | string[];
  model_user_id?: string;
  va_content_assignment_id?: string;
  assignment_title?: string;
  type?: string;
  airbnb_link?: string;
  notes?: string;
  status?: string;
  admin_notes?: string;
  created_at?: string;
  updated_at?: string;
};

const TYPES: ModelExpenseRequestType[] = ["airbnb", "other"];
const STATUSES: ModelExpenseRequestStatus[] = ["pending", "approved", "rejected"];

function asType(raw: unknown): ModelExpenseRequestType {
  const v = typeof raw === "string" ? raw.trim() : "";
  return TYPES.includes(v as ModelExpenseRequestType) ? (v as ModelExpenseRequestType) : "other";
}

function asStatus(raw: unknown): ModelExpenseRequestStatus {
  const v = typeof raw === "string" ? raw.trim() : "";
  return STATUSES.includes(v as ModelExpenseRequestStatus) ? (v as ModelExpenseRequestStatus) : "pending";
}

function mapRecord(rec: AirtableRecord<Fields>): ModelExpenseRequest {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    request_id: String(f.request_id ?? "").trim(),
    model_id: firstLinkedId(f.model_id) ?? "",
    model_user_id: String(f.model_user_id ?? "").trim(),
    va_content_assignment_id: String(f.va_content_assignment_id ?? "").trim(),
    assignment_title: String(f.assignment_title ?? "").trim(),
    type: asType(f.type),
    airbnb_link: String(f.airbnb_link ?? "").trim(),
    notes: String(f.notes ?? "").trim(),
    status: asStatus(f.status),
    admin_notes: String(f.admin_notes ?? "").trim(),
    created_at: String(f.created_at ?? "").trim(),
    updated_at: String(f.updated_at ?? "").trim(),
  };
}

export async function listModelExpenseRequestsForModel(modelRecordId: string): Promise<ModelExpenseRequest[]> {
  const id = modelRecordId?.trim();
  if (!id) return [];
  const records = await listAllRecords<Fields>(TABLE, { sort: [{ field: "created_at", direction: "desc" }] });
  return records.map(mapRecord).filter((r) => r.model_id === id);
}

export async function listAllModelExpenseRequests(): Promise<ModelExpenseRequest[]> {
  const records = await listAllRecords<Fields>(TABLE, { sort: [{ field: "created_at", direction: "desc" }] });
  return records.map(mapRecord);
}

export async function createModelExpenseRequest(input: {
  model_id: string;
  model_user_id: string;
  va_content_assignment_id: string;
  assignment_title: string;
  type: ModelExpenseRequestType;
  airbnb_link: string;
  notes?: string;
}): Promise<ModelExpenseRequest> {
  const now = new Date().toISOString();
  const rec = await createRecord<Fields>(TABLE, {
    request_id: `mer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    model_id: [input.model_id],
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
  } as Fields);
  return mapRecord(rec as AirtableRecord<Fields>);
}

export async function updateModelExpenseRequest(
  recordId: string,
  input: Partial<Pick<ModelExpenseRequest, "status" | "admin_notes">>
): Promise<ModelExpenseRequest> {
  const fields: Partial<Fields> = { updated_at: new Date().toISOString() };
  if (input.status !== undefined) fields.status = input.status;
  if (input.admin_notes !== undefined) fields.admin_notes = input.admin_notes;
  const rec = await updateRecord<Fields>(TABLE, recordId, fields);
  return mapRecord(rec as AirtableRecord<Fields>);
}
