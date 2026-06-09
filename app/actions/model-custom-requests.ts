"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import {
  getUserByAirtableId,
  getActiveModelUserAirtableIdByLinkedModelRecordId,
} from "@/services/users";
import {
  getCustomRequestById,
  updateCustomRequestModelSchedule,
} from "@/services/custom-requests";
import { createModelScheduleItemForCustom } from "@/services/model-schedule";
import { notify, notifyAdmins } from "@/services/notification-service";
import { notifyAssignedVirtualAssistantCustomUploaded } from "@/services/custom-request-notify-vas";
import { NOTIFICATION_EVENT, NOTIFICATION_ENTITY, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import {
  customScheduledAdmin,
  customScheduledChatter,
  customUploadedChatter,
  formatTimeShort,
} from "@/lib/notification-copy";

export type ModelCustomRequestActionResult = { success: true } | { success: false; error: string };

async function linkedModelIdForModelSession(): Promise<string | null> {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "model") return null;
  const recordId = (session.airtableUserId ?? session.id)?.trim();
  if (!recordId) return null;
  const user = await getUserByAirtableId(recordId);
  if (!user?.linked_model_id) return null;
  return user.linked_model_id;
}

function localDateTimeIso(dateYmd: string, timeHhMm: string): string {
  const [y, mo, d] = dateYmd.split("-").map((x) => Number(x));
  const parts = timeHhMm.trim().split(":");
  const hh = Number(parts[0]);
  const mm = Number(parts[1] ?? 0);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d) || !Number.isFinite(hh)) return "";
  const dt = new Date(y, mo - 1, d, hh, Number.isFinite(mm) ? mm : 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString();
}

function mergeNotes(existing: string, addition: string): string {
  const a = existing.trim();
  const b = addition.trim();
  if (a && b) return `${a}\n\n${b}`;
  return a || b;
}

/**
 * Model sets a date/time on an accepted custom still in `waiting_schedule`, creates a `model_schedule` row, and notifies chatter + admins.
 */
export async function scheduleMyCustomRequestAction(input: {
  recordId: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string;
}): Promise<ModelCustomRequestActionResult> {
  const session = await getSessionFromCookies();
  const linkedModelId = await linkedModelIdForModelSession();
  if (!linkedModelId) {
    return { success: false, error: "Your account is not linked as a model." };
  }
  const createdByRecordId = (session?.airtableUserId ?? session?.id)?.trim() ?? "";

  const id = input.recordId?.trim();
  if (!id) return { success: false, error: "Missing request." };

  const date = input.date?.trim().slice(0, 10);
  const startT = input.startTime?.trim();
  const endT = input.endTime?.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { success: false, error: "Pick a valid date." };
  }
  if (!startT || !endT) {
    return { success: false, error: "Start and end time are required." };
  }

  const startIso = localDateTimeIso(date, startT.length <= 5 ? `${startT}:00` : startT);
  const endIso = localDateTimeIso(date, endT.length <= 5 ? `${endT}:00` : endT);
  if (!startIso || !endIso) {
    return { success: false, error: "Invalid date or time." };
  }
  if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
    return { success: false, error: "End time must be after start time." };
  }

  const existing = await getCustomRequestById(id);
  if (!existing) return { success: false, error: "Request not found." };
  if (existing.assigned_model_id !== linkedModelId) {
    return { success: false, error: "This request is not assigned to you." };
  }
  if (existing.admin_status !== "accepted") {
    return { success: false, error: "This request is not approved yet." };
  }
  if (existing.model_status !== "waiting_schedule") {
    return { success: false, error: "Only pending requests can be scheduled." };
  }

  const modelName = (existing.assigned_model_name ?? "").trim() || "Model";
  const customTitle = (existing.request_title ?? "").trim() || "Custom request";
  const timeRange = `${formatTimeShort(startIso)}–${formatTimeShort(endIso)}`;

  try {
    const scheduleItem = await createModelScheduleItemForCustom({
      model_record_id: linkedModelId,
      custom_request_id: id,
      title: customTitle,
      date,
      start_time: startIso,
      end_time: endIso,
      details: (input.notes ?? "").trim(),
      model_name: modelName,
      chatter_record_id: existing.requested_by_chatter_id?.trim() || null,
      created_by_record_id: createdByRecordId || null,
    });

    const nextNotes = mergeNotes(existing.model_notes ?? "", input.notes?.trim() ?? "");

    await updateCustomRequestModelSchedule(id, {
      model_status: "scheduled",
      model_scheduled_date: date,
      model_scheduled_start: startIso,
      model_scheduled_end: endIso,
      model_notes: nextNotes,
      linked_schedule_item_id: scheduleItem.id,
    });

    if (existing.requested_by_chatter_id) {
      const { title, body } = customScheduledChatter(customTitle, date, timeRange);
      await notify({
        user_id: existing.requested_by_chatter_id,
        event_type: NOTIFICATION_EVENT.CUSTOM_SCHEDULED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title,
        body,
        entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
        entity_id: id,
        actor_user_id: createdByRecordId || undefined,
        actor_name: modelName,
        _triggerSource: "scheduleMyCustomRequest_chatter",
      }).catch((e) => console.error("[notify] scheduleMyCustomRequest chatter failed", e));
    }

    const adminCopy = customScheduledAdmin(modelName, date, timeRange);
    await notifyAdmins({
      event_type: NOTIFICATION_EVENT.CUSTOM_SCHEDULED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: adminCopy.title,
      body: `${adminCopy.body} (${customTitle}).`,
      entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
      entity_id: id,
      actor_user_id: createdByRecordId || undefined,
      actor_name: modelName,
    }).catch((e) => console.error("[notify] scheduleMyCustomRequest admins failed", e));

    const modelUserId = await getActiveModelUserAirtableIdByLinkedModelRecordId(linkedModelId);
    if (modelUserId) {
      await notify({
        user_id: modelUserId,
        event_type: NOTIFICATION_EVENT.CUSTOM_SCHEDULED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: "📅 Custom scheduled",
        body: `A custom "${customTitle}" has been scheduled. Check your calendar.`,
        entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
        entity_id: id,
        actor_user_id: createdByRecordId || undefined,
        actor_name: modelName,
        _triggerSource: "scheduleMyCustomRequest_model",
      }).catch((e) => console.error("[notify] scheduleMyCustomRequest model failed", e));
    }

    const { broadcastRealtimeToAll } = await import("@/lib/realtime-broadcast");
    await broadcastRealtimeToAll({ type: "custom_request_updated", custom_request_id: id }).catch(() => {});

    revalidatePath(ROUTES.model.customs);
    revalidatePath(ROUTES.model.home);
    revalidatePath(ROUTES.model.schedule);
    revalidatePath(ROUTES.chatter.requestCustom);
    revalidatePath(ROUTES.admin.customs);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message || "Schedule failed." };
  }
}

/**
 * Model marks an in-progress or scheduled custom as uploaded; notifies chatter + admins.
 */
export async function markMyCustomRequestUploadedAction(recordId: string): Promise<ModelCustomRequestActionResult> {
  const session = await getSessionFromCookies();
  const actorUserId = (session?.airtableUserId ?? session?.id)?.trim() || undefined;

  const linkedModelId = await linkedModelIdForModelSession();
  if (!linkedModelId) {
    return { success: false, error: "Your account is not linked as a model." };
  }

  const id = recordId?.trim();
  if (!id) return { success: false, error: "Missing request." };

  const existing = await getCustomRequestById(id);
  if (!existing) return { success: false, error: "Request not found." };
  if (existing.assigned_model_id !== linkedModelId) {
    return { success: false, error: "This request is not assigned to you." };
  }
  if (existing.admin_status !== "accepted") {
    return { success: false, error: "This request is not approved yet." };
  }
  if (existing.model_status !== "scheduled" && existing.model_status !== "in_progress") {
    return { success: false, error: "Only scheduled work can be marked as uploaded." };
  }

  const modelName = (existing.assigned_model_name ?? "").trim() || "Model";
  const customTitle = (existing.request_title ?? "").trim() || "Custom request";
  const uploadedAt = new Date().toISOString();

  try {
    await updateCustomRequestModelSchedule(id, {
      model_status: "uploaded",
      uploaded_at: uploadedAt,
      uploaded_by_model: true,
    });

    const { title, body } = customUploadedChatter(customTitle);

    if (existing.requested_by_chatter_id) {
      await notify({
        user_id: existing.requested_by_chatter_id,
        event_type: NOTIFICATION_EVENT.CUSTOM_UPLOADED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title,
        body,
        entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
        entity_id: id,
        actor_user_id: actorUserId,
        actor_name: modelName,
        _triggerSource: "markMyCustomRequestUploaded_chatter",
      }).catch((e) => console.error("[notify] markMyCustomRequestUploaded chatter failed", e));
    }

    await notifyAdmins({
      event_type: NOTIFICATION_EVENT.CUSTOM_UPLOADED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title,
      body: `${body} Model: ${modelName}.`,
      entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
      entity_id: id,
      actor_user_id: actorUserId,
      actor_name: modelName,
    }).catch((e) => console.error("[notify] markMyCustomRequestUploaded admins failed", e));

    const modelUserId = await getActiveModelUserAirtableIdByLinkedModelRecordId(linkedModelId);
    if (modelUserId) {
      await notify({
        user_id: modelUserId,
        event_type: NOTIFICATION_EVENT.CUSTOM_UPLOADED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: "✅ Upload confirmed",
        body: `Your upload for "${customTitle}" has been received.`,
        entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
        entity_id: `${id}:upload_model_confirm`,
        actor_user_id: actorUserId,
        actor_name: modelName,
        _triggerSource: "markMyCustomRequestUploaded_model",
      }).catch((e) => console.error("[notify] markMyCustomRequestUploaded model failed", e));
    }

    await notifyAssignedVirtualAssistantCustomUploaded({
      assigned_va_id: existing.assigned_va_id ?? "",
      request_title: customTitle,
      custom_request_id: id,
    });

    const { broadcastRealtimeToAll } = await import("@/lib/realtime-broadcast");
    await broadcastRealtimeToAll({ type: "custom_request_updated", custom_request_id: id }).catch(() => {});

    revalidatePath(ROUTES.model.customs);
    revalidatePath(ROUTES.model.home);
    revalidatePath(ROUTES.chatter.requestCustom);
    revalidatePath(ROUTES.admin.customs);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message || "Update failed." };
  }
}
