"use server";

/**
 * Shared agency queue actions for **custom_requests** (admin + virtual_assistant).
 * Airtable `admin_status`: **pending** | **accepted** | **rejected** — not "approved"/"declined".
 * User-facing "Approve" maps to `accepted`; "Decline" maps to `rejected` + `decline_reason`.
 */

import { updateRecord } from "@/lib/airtable-server";
import { getActiveModelUserAirtableIdByLinkedModelRecordId } from "@/services/users";
import { notify, notifyByRoleConfig } from "@/services/notification-service";
import {
  NOTIFICATION_ENTITY,
  NOTIFICATION_EVENT,
  NOTIFICATION_PRIORITY,
} from "@/lib/notification-types";
import { getCustomRequestById, patchCustomRequestRecord } from "@/services/custom-requests";

export type AgencyQueueResult = { ok: true } | { ok: false; error: string };

/** Table field `custom_requests` — patch admin_notes via updateRecord (not exposed on narrow patch type). */
const TABLE = "custom_requests";

type NotesFields = { admin_notes?: string };

export async function agencyApproveCustomRequest(recordId: string): Promise<AgencyQueueResult> {
  const before = await getCustomRequestById(recordId);
  if (!before) return { ok: false, error: "Request not found." };
  if (before.admin_status !== "pending") {
    return { ok: false, error: "Only pending requests can be approved here." };
  }
  await patchCustomRequestRecord(recordId, { admin_status: "accepted" });
  const customTitle = (before.request_title || "Custom request").trim() || "Custom request";
  const modelUserId = await getActiveModelUserAirtableIdByLinkedModelRecordId(before.assigned_model_id);
  const modelName = (before.assigned_model_name ?? "Model").trim() || "Model";
  if (modelUserId) {
    await notifyByRoleConfig(NOTIFICATION_EVENT.CUSTOM_APPROVED, {
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "✅ Custom request approved",
      body: `A custom request "${customTitle}" has been approved. Please check your schedule.`,
      entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
      entity_id: recordId,
      actor_user_id: modelUserId,
      actor_name: modelName,
      personal_user_id: modelUserId,
      context: { customTitle, modelName, fanUsername: before.fan_username },
    }).catch(() => {});
  }
  return { ok: true };
}

export async function agencyDeclineCustomRequest(
  recordId: string,
  decline_reason: string
): Promise<AgencyQueueResult> {
  const reason = decline_reason.trim();
  if (!reason) return { ok: false, error: "Reason is required." };
  const before = await getCustomRequestById(recordId);
  if (!before) return { ok: false, error: "Request not found." };
  if (before.admin_status !== "pending") {
    return { ok: false, error: "Only pending requests can be declined here." };
  }
  await patchCustomRequestRecord(recordId, {
    admin_status: "rejected",
    decline_reason: reason,
  });
  const customTitle = (before.request_title || "Custom request").trim() || "Custom request";
  const modelUserId = await getActiveModelUserAirtableIdByLinkedModelRecordId(before.assigned_model_id);
  if (modelUserId) {
    await notifyByRoleConfig(NOTIFICATION_EVENT.CUSTOM_DECLINED, {
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "❌ Custom request declined",
      body: `${customTitle} was declined. Reason: ${reason.slice(0, 280)}${reason.length > 280 ? "…" : ""}`,
      entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
      entity_id: recordId,
      personal_user_id: modelUserId,
      context: { customTitle, fanUsername: before.fan_username },
    }).catch(() => {});
  }
  return { ok: true };
}

/** Who performed an agency edit (admin UI vs VA UI) — used in model copy when request is scheduled/uploaded. */
export type AgencyCustomEditEditor = "admin" | "virtual_assistant";

/**
 * Patch description / price / deadline for `admin_status` **pending** or **accepted**.
 * Notifies chatter (pending only) and model using existing `notify()` helpers.
 * When `model_status` is `scheduled` or `uploaded`, the model receives a high-priority in-app notification
 * with copy: "{Admin|VA} edited request for {fan_username} - review changes." instead of the generic update.
 */
export async function agencyEditCustomRequest(
  recordId: string,
  input: { request_details?: string; price?: string; deadline_requested?: string | null },
  editor: AgencyCustomEditEditor
): Promise<AgencyQueueResult> {
  const before = await getCustomRequestById(recordId);
  if (!before) return { ok: false, error: "Request not found." };
  if (before.admin_status !== "pending" && before.admin_status !== "accepted") {
    return { ok: false, error: "Only pending or accepted requests can be edited here." };
  }
  if (before.admin_status === "accepted") {
    if (before.model_status !== "scheduled" && before.model_status !== "uploaded") {
      return {
        ok: false,
        error: "Accepted customs can only be edited here after they are scheduled or uploaded.",
      };
    }
  }
  const fields: Parameters<typeof patchCustomRequestRecord>[1] = {};
  if (input.request_details !== undefined) fields.request_details = input.request_details ?? "";
  if (input.price !== undefined) fields.price = input.price ?? "";
  if (input.deadline_requested !== undefined) {
    fields.deadline_requested =
      input.deadline_requested == null || input.deadline_requested === ""? "": input.deadline_requested;
  }
  if (Object.keys(fields).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }
  await patchCustomRequestRecord(recordId, fields);

  const customTitle = (before.request_title || "Custom request").trim() || "Custom request";
  const genericBody = `📝 ${customTitle}: description, price, or deadline was updated.`;
  const fan = (before.fan_username || "fan").trim() || "fan";
  const editorWord = editor === "virtual_assistant" ? "VA" : "Admin";
  const modelPipelineBody = `📝 ${editorWord} edited request for ${fan} - review changes.`;

  const modelUserId = await getActiveModelUserAirtableIdByLinkedModelRecordId(before.assigned_model_id);
  const modelNeedsPipelineNote =
    before.model_status === "scheduled" || before.model_status === "uploaded";

  if (before.requested_by_chatter_id && before.admin_status === "pending") {
    await notify({
      user_id: before.requested_by_chatter_id,
      event_type: NOTIFICATION_EVENT.CUSTOM_EDITED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "📝 Custom Request Updated",
      body: genericBody,
      entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
      entity_id: recordId,
      _triggerSource: `agencyEditCustomRequest_chatter_${editor}`,
    }).catch(() => {});
  }

  if (before.requested_by_chatter_id && before.admin_status === "accepted" && modelNeedsPipelineNote) {
    await notify({
      user_id: before.requested_by_chatter_id,
      event_type: NOTIFICATION_EVENT.CUSTOM_EDITED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "📝 Custom Request Updated",
      body: genericBody,
      entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
      entity_id: recordId,
      _triggerSource: `agencyEditCustomRequest_chatter_accepted_${editor}`,
    }).catch(() => {});
  }

  if (modelUserId) {
    if (modelNeedsPipelineNote) {
      await notify({
        user_id: modelUserId,
        event_type: NOTIFICATION_EVENT.CUSTOM_EDITED,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: "📝 Custom Request Updated",
        body: modelPipelineBody,
        entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
        entity_id: recordId,
        _triggerSource: `agencyEditCustomRequest_model_pipeline_${editor}`,
      }).catch(() => {});
    } else {
      await notify({
        user_id: modelUserId,
        event_type: NOTIFICATION_EVENT.CUSTOM_EDITED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: "📝 Custom Request Updated",
        body: genericBody,
        entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
        entity_id: recordId,
        _triggerSource: `agencyEditCustomRequest_model_${editor}`,
      }).catch(() => {});
    }
  }

  return { ok: true };
}

export async function agencyAppendAdminNote(recordId: string, note: string): Promise<AgencyQueueResult> {
  const trimmed = note.trim();
  if (!trimmed) return { ok: false, error: "Note is required." };
  const before = await getCustomRequestById(recordId);
  if (!before) return { ok: false, error: "Request not found." };
  const prev = (before.admin_notes ?? "").trim();
  const stamp = new Date().toISOString().slice(0, 19).replace("T", " ");
  const block = `[${stamp}]\n${trimmed}`;
  const next = prev ? `${prev}\n\n${block}` : block;
  await updateRecord<NotesFields & { updated_at?: string }>(TABLE, recordId, {
    admin_notes: next,
    updated_at: new Date().toISOString(),
  });
  return { ok: true };
}
