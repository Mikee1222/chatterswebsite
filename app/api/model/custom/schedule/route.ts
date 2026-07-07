import { NextResponse } from "next/server";
import { z } from "zod";
import { requireModelApiContext } from "@/lib/model-api-auth";
import {
  getCustomRequestById,
  updateCustomRequestModelSchedule,
} from "@/services/custom-requests";
import { createModelScheduleItemForCustom } from "@/services/model-schedule";
import { notify, notifyAdmins } from "@/services/notification-service";
import { customScheduledModel } from "@/lib/notification-copy";
import { NOTIFICATION_EVENT, NOTIFICATION_ENTITY, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { getActiveModelUserAirtableIdByLinkedModelRecordId } from "@/services/users";
import { notifyAssignedVirtualAssistantCustomUploaded } from "@/services/custom-request-notify-vas";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const bodySchema = z.object({
  request_id: z.string().min(1),
  scheduled_date: ymd,
  notes: z.string().max(5000).optional(),
  scheduled_start: z.string().optional(),
  scheduled_end: z.string().optional(),
});

export async function POST(req: Request) {
  const ctx = await requireModelApiContext();
  if (!ctx.ok) return ctx.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const recordId = parsed.data.request_id.trim();
  try {
    const existing = await getCustomRequestById(recordId);
    if (!existing || existing.assigned_model_id !== ctx.linkedModelId) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (existing.admin_status !== "accepted") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const scheduleItem = await createModelScheduleItemForCustom({
      model_record_id: ctx.linkedModelId,
      custom_request_id: recordId,
      title: (existing.request_title ?? "Custom").trim() || "Custom",
      date: parsed.data.scheduled_date,
      start_time: parsed.data.scheduled_start?.trim() || null,
      end_time: parsed.data.scheduled_end?.trim() || null,
      details: parsed.data.notes?.trim() || existing.request_details || "",
      model_name: (ctx.modelRecord.model_name ?? "").trim() || "Model",
      chatter_record_id: existing.requested_by_chatter_id?.trim() || null,
      created_by_record_id: ctx.userRecordId,
    });

    await updateCustomRequestModelSchedule(recordId, {
      model_status: "scheduled",
      model_scheduled_date: parsed.data.scheduled_date,
      ...(parsed.data.scheduled_start?.trim()
        ? { model_scheduled_start: parsed.data.scheduled_start.trim() }
        : {}),
      ...(parsed.data.scheduled_end?.trim() ? { model_scheduled_end: parsed.data.scheduled_end.trim() } : {}),
      ...(parsed.data.notes?.trim() ? { model_notes: parsed.data.notes.trim() } : {}),
      linked_schedule_item_id: scheduleItem.id,
    });

    const modelName = (ctx.modelRecord.model_name ?? "").trim() || "Model";
    const chatterId = existing.requested_by_chatter_id?.trim();
    if (chatterId) {
      await notify({
        user_id: chatterId,
        event_type: NOTIFICATION_EVENT.CUSTOM_SCHEDULED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: "📅 Custom scheduled",
        body: `${modelName} scheduled your custom for ${parsed.data.scheduled_date}.`,
        entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
        entity_id: recordId,
        actor_name: modelName,
        _triggerSource: "model_custom_schedule_api_chatter",
      }).catch(() => {});
    }
    await notifyAdmins({
      event_type: NOTIFICATION_EVENT.CUSTOM_SCHEDULED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "📅 Custom scheduled",
      body: `${modelName} scheduled a custom (${existing.request_title || "Custom"}) for ${parsed.data.scheduled_date}.`,
      entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
      entity_id: recordId,
      actor_name: modelName,
    }).catch(() => {});

    const customTitle = (existing.request_title || "Custom request").trim() || "Custom request";
    const modelUserId = await getActiveModelUserAirtableIdByLinkedModelRecordId(ctx.linkedModelId);
    if (modelUserId) {
      const modelCopy = customScheduledModel(customTitle);
      await notify({
        user_id: modelUserId,
        event_type: NOTIFICATION_EVENT.CUSTOM_SCHEDULED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: modelCopy.title,
        body: modelCopy.body,
        entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
        entity_id: recordId,
        actor_name: modelName,
        _triggerSource: "model_custom_schedule_api_model",
      }).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
