/**
 * Supabase backend for services/model-content-requests.ts
 */

import {
  publicId,
  sbFirstLinkedAirtableId,
  sbInsert,
  sbSelectAll,
  sbUpdateByPublicId,
  requireSbUuids,
  type SbRow,
} from "@/lib/supabase-data";
import { notify, notifyAdmins } from "@/services/notification-service";
import { NOTIFICATION_EVENT, NOTIFICATION_ENTITY, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import type { ModelContentRequest, ModelContentRequestStatus, ModelContentRequestType } from "@/types";

const TABLE = "model_content_requests";

type Row = SbRow & {
  request_id?: string | null;
  model_id?: string[] | null;
  model_user_id?: string | null;
  type?: string | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  admin_notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const REQUEST_TYPES: ModelContentRequestType[] = ["script", "mass", "photo_set", "video", "other"];
const REQUEST_STATUSES: ModelContentRequestStatus[] = [
  "pending",
  "approved",
  "rejected",
  "in_progress",
  "completed",
];

function asType(raw: unknown): ModelContentRequestType {
  const v = typeof raw === "string" ? raw.trim() : "";
  return REQUEST_TYPES.includes(v as ModelContentRequestType)
    ? (v as ModelContentRequestType)
    : "other";
}

function asStatus(raw: unknown): ModelContentRequestStatus {
  const v = typeof raw === "string" ? raw.trim() : "";
  return REQUEST_STATUSES.includes(v as ModelContentRequestStatus)
    ? (v as ModelContentRequestStatus)
    : "pending";
}

async function mapRow(row: Row): Promise<ModelContentRequest> {
  const model_id = (await sbFirstLinkedAirtableId("modelss", row.model_id)) ?? "";
  return {
    id: publicId(row),
    request_id: String(row.request_id ?? "").trim(),
    model_id,
    model_user_id: String(row.model_user_id ?? "").trim(),
    type: asType(row.type),
    title: String(row.title ?? "").trim(),
    description: String(row.description ?? "").trim(),
    status: asStatus(row.status),
    admin_notes: String(row.admin_notes ?? "").trim(),
    created_at: String(row.created_at ?? "").trim(),
    updated_at: String(row.updated_at ?? "").trim(),
  };
}

export async function listModelContentRequestsForModel(
  modelRecordId: string
): Promise<ModelContentRequest[]> {
  const id = modelRecordId?.trim();
  if (!id) return [];
  const all = await listAllModelContentRequests();
  return all.filter((r) => r.model_id === id);
}

export async function listAllModelContentRequests(): Promise<ModelContentRequest[]> {
  const rows = await sbSelectAll<Row>(TABLE);
  const mapped = await Promise.all(rows.map(mapRow));
  mapped.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return mapped;
}

export async function createModelContentRequest(input: {
  model_id: string;
  model_user_id: string;
  type: ModelContentRequestType;
  title: string;
  description: string;
}): Promise<ModelContentRequest> {
  const now = new Date().toISOString();
  const modelUuids = await requireSbUuids("modelss", [input.model_id], "model");
  const inserted = await sbInsert<Row>(TABLE, {
    request_id: `mcr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    model_id: modelUuids,
    model_user_id: input.model_user_id,
    type: input.type,
    title: input.title.trim(),
    description: input.description.trim(),
    status: "pending",
    admin_notes: "",
    created_at: now,
    updated_at: now,
  });
  const created = await mapRow(inserted);

  await notifyAdmins({
    event_type: NOTIFICATION_EVENT.MODEL_CONTENT_REQUEST_CREATED,
    priority: NOTIFICATION_PRIORITY.HIGH,
    title: "🎬 New content request",
    body: `A model filed a new content request: "${created.title || created.type}".`,
    entity_type: NOTIFICATION_ENTITY.MODEL_CONTENT_REQUEST,
    entity_id: created.id,
    actor_user_id: created.model_user_id || undefined,
    _triggerSource: "model_content_request_created",
  }).catch((err) => {
    console.error("[model_content_request_created] notify failed", err);
  });

  return created;
}

export async function updateModelContentRequest(
  recordId: string,
  input: Partial<Pick<ModelContentRequest, "status" | "admin_notes">>
): Promise<ModelContentRequest> {
  const fields: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.status !== undefined) fields.status = input.status;
  if (input.admin_notes !== undefined) fields.admin_notes = input.admin_notes;
  const updated = await sbUpdateByPublicId<Row>(TABLE, recordId, fields);
  const mapped = await mapRow(updated);

  if (input.status !== undefined && mapped.model_user_id) {
    await notify({
      user_id: mapped.model_user_id,
      event_type: NOTIFICATION_EVENT.MODEL_CONTENT_REQUEST_REVIEWED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "🎬 Content request updated",
      body: `Your content request "${mapped.title || mapped.type}" is now ${mapped.status.replace(/_/g, " ")}.`,
      entity_type: NOTIFICATION_ENTITY.MODEL_CONTENT_REQUEST,
      entity_id: mapped.id,
      _triggerSource: "model_content_request_reviewed",
    }).catch((err) => {
      console.error("[model_content_request_reviewed] notify failed", err);
    });
  }

  return mapped;
}
