"use server";

import { createRecord, listAllRecords, updateRecord, type AirtableRecord } from "@/lib/airtable-server";
import { firstLinkedId } from "@/lib/airtable-linked";
import type { ModelContentRequest, ModelContentRequestStatus, ModelContentRequestType } from "@/types";

const TABLE = "model_content_requests";

type Fields = {
  request_id?: string;
  model_id?: string | string[];
  model_user_id?: string;
  type?: string;
  title?: string;
  description?: string;
  status?: string;
  admin_notes?: string;
  created_at?: string;
  updated_at?: string;
};

const REQUEST_TYPES: ModelContentRequestType[] = ["script", "mass", "photo_set", "video", "other"];
const REQUEST_STATUSES: ModelContentRequestStatus[] = ["pending", "approved", "rejected", "in_progress", "completed"];

function asType(raw: unknown): ModelContentRequestType {
  const v = typeof raw === "string" ? raw.trim() : "";
  return REQUEST_TYPES.includes(v as ModelContentRequestType) ? (v as ModelContentRequestType) : "other";
}

function asStatus(raw: unknown): ModelContentRequestStatus {
  const v = typeof raw === "string" ? raw.trim() : "";
  return REQUEST_STATUSES.includes(v as ModelContentRequestStatus) ? (v as ModelContentRequestStatus) : "pending";
}

function mapRecord(rec: AirtableRecord<Fields>): ModelContentRequest {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    request_id: String(f.request_id ?? "").trim(),
    model_id: firstLinkedId(f.model_id) ?? "",
    model_user_id: String(f.model_user_id ?? "").trim(),
    type: asType(f.type),
    title: String(f.title ?? "").trim(),
    description: String(f.description ?? "").trim(),
    status: asStatus(f.status),
    admin_notes: String(f.admin_notes ?? "").trim(),
    created_at: String(f.created_at ?? "").trim(),
    updated_at: String(f.updated_at ?? "").trim(),
  };
}

export async function listModelContentRequestsForModel(modelRecordId: string): Promise<ModelContentRequest[]> {
  const id = modelRecordId?.trim();
  if (!id) return [];
  const records = await listAllRecords<Fields>(TABLE, {
    sort: [{ field: "created_at", direction: "desc" }],
  });
  return records.map((r) => mapRecord(r)).filter((r) => r.model_id === id);
}

export async function listAllModelContentRequests(): Promise<ModelContentRequest[]> {
  const records = await listAllRecords<Fields>(TABLE, {
    sort: [{ field: "created_at", direction: "desc" }],
  });
  return records.map((r) => mapRecord(r));
}

export async function createModelContentRequest(input: {
  model_id: string;
  model_user_id: string;
  type: ModelContentRequestType;
  title: string;
  description: string;
}): Promise<ModelContentRequest> {
  const now = new Date().toISOString();
  const rec = await createRecord<Fields>(TABLE, {
    request_id: `mcr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    model_id: [input.model_id],
    model_user_id: input.model_user_id,
    type: input.type,
    title: input.title.trim(),
    description: input.description.trim(),
    status: "pending",
    admin_notes: "",
    created_at: now,
    updated_at: now,
  } as Fields);
  return mapRecord(rec as AirtableRecord<Fields>);
}

export async function updateModelContentRequest(
  recordId: string,
  input: Partial<Pick<ModelContentRequest, "status" | "admin_notes">>
): Promise<ModelContentRequest> {
  const fields: Partial<Fields> = {
    updated_at: new Date().toISOString(),
  };
  if (input.status !== undefined) fields.status = input.status;
  if (input.admin_notes !== undefined) fields.admin_notes = input.admin_notes;
  const rec = await updateRecord<Fields>(TABLE, recordId, fields);
  return mapRecord(rec as AirtableRecord<Fields>);
}
