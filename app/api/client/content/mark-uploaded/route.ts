import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClientModelAccess } from "@/lib/client-content-auth";
import { ROUTES } from "@/lib/routes";
import { customUploadedChatter } from "@/lib/notification-copy";
import {
  NOTIFICATION_EVENT,
  NOTIFICATION_ENTITY,
  NOTIFICATION_PRIORITY,
} from "@/lib/notification-types";
import {
  getCustomRequestById,
  updateCustomRequestModelSchedule,
} from "@/services/custom-requests";
import { notifyAssignedVirtualAssistantCustomUploaded } from "@/services/custom-request-notify-vas";
import { notify, notifyAdmins } from "@/services/notification-service";
import { getModelById } from "@/services/modelss";
import { getActiveModelUserAirtableIdByLinkedModelRecordId } from "@/services/users";

const bodySchema = z.object({
  record_id: z.string().min(1),
  model_id: z.string().min(1),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { record_id, model_id } = parsed.data;
  const access = await requireClientModelAccess(model_id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const existing = await getCustomRequestById(record_id);
  if (!existing) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  if (existing.assigned_model_id !== model_id) {
    return NextResponse.json({ error: "This request is not assigned to this model." }, { status: 403 });
  }
  if (existing.admin_status !== "accepted") {
    return NextResponse.json({ error: "This request is not approved yet." }, { status: 400 });
  }
  if (existing.model_status !== "scheduled" && existing.model_status !== "in_progress") {
    return NextResponse.json({ error: "Only scheduled work can be marked as uploaded." }, { status: 400 });
  }

  const modelRecord = await getModelById(model_id).catch(() => null);
  const modelName = modelRecord?.model_name?.trim() || existing.assigned_model_name?.trim() || "Model";
  const customTitle = (existing.request_title ?? "").trim() || "Custom request";
  const uploadedAt = new Date().toISOString();

  try {
    await updateCustomRequestModelSchedule(record_id, {
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
        entity_id: record_id,
        actor_user_id: access.actorUserId,
        actor_name: access.actorName,
        _triggerSource: "client_mark_uploaded_chatter",
      }).catch(() => {});
    }

    await notifyAdmins({
      event_type: NOTIFICATION_EVENT.CUSTOM_UPLOADED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title,
      body: `${body} Model: ${modelName}. Marked by ${access.actorName}.`,
      entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
      entity_id: record_id,
      actor_user_id: access.actorUserId,
      actor_name: access.actorName,
    }).catch(() => {});

    const modelUserId = await getActiveModelUserAirtableIdByLinkedModelRecordId(model_id);
    if (modelUserId) {
      await notify({
        user_id: modelUserId,
        event_type: NOTIFICATION_EVENT.CUSTOM_UPLOADED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: " Upload confirmed",
        body: `Your upload for "${customTitle}" has been received.`,
        entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
        entity_id: `${record_id}:upload_model_confirm`,
        actor_user_id: access.actorUserId,
        actor_name: access.actorName,
        _triggerSource: "client_mark_uploaded_model",
      }).catch(() => {});
    }

    await notifyAssignedVirtualAssistantCustomUploaded({
      assigned_va_id: existing.assigned_va_id ?? "",
      request_title: customTitle,
      custom_request_id: record_id,
      actor_name: access.actorName,
    });

    const { broadcastRealtimeToAll } = await import("@/lib/realtime-broadcast");
    await broadcastRealtimeToAll({ type: "custom_request_updated", custom_request_id: record_id }).catch(
      () => {},
    );

    revalidatePath(ROUTES.client.content);
    revalidatePath(ROUTES.model.customs);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message || "Update failed." }, { status: 500 });
  }
}
