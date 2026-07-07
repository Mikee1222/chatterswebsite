import { NextResponse } from "next/server";
import { z } from "zod";
import { requireModelApiContext } from "@/lib/model-api-auth";
import { getCustomRequestById, updateCustomRequestModelSchedule } from "@/services/custom-requests";
import { notify, notifyAdmins } from "@/services/notification-service";
import { customUploadConfirmedModel } from "@/lib/notification-copy";
import { NOTIFICATION_EVENT, NOTIFICATION_ENTITY, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { getActiveModelUserAirtableIdByLinkedModelRecordId } from "@/services/users";
import { notifyAssignedVirtualAssistantCustomUploaded } from "@/services/custom-request-notify-vas";

const bodySchema = z.object({
  request_id: z.string().min(1),
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

    const uploadedAt = new Date().toISOString();
    await updateCustomRequestModelSchedule(recordId, {
      model_status: "uploaded",
      uploaded_at: uploadedAt,
      uploaded_by_model: true,
    });

    const modelName = (ctx.modelRecord.model_name ?? "").trim() || "Model";
    const customTitle = (existing.request_title || "Custom request").trim() || "Custom request";
    const chatterId = existing.requested_by_chatter_id?.trim();
    if (chatterId) {
      await notify({
        user_id: chatterId,
        event_type: NOTIFICATION_EVENT.CUSTOM_UPLOADED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: "✅ Custom uploaded",
        body: `${modelName} marked your custom as uploaded.`,
        entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
        entity_id: recordId,
        actor_name: modelName,
        _triggerSource: "model_custom_uploaded_api_chatter",
      }).catch(() => {});
    }
    await notifyAdmins({
      event_type: NOTIFICATION_EVENT.CUSTOM_UPLOADED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "✅ Custom uploaded",
      body: `${modelName} uploaded deliverables for ${existing.request_title || "a custom"}.`,
      entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
      entity_id: recordId,
      actor_name: modelName,
    }).catch(() => {});

    const modelUserId = await getActiveModelUserAirtableIdByLinkedModelRecordId(ctx.linkedModelId);
    if (modelUserId) {
      await notify({
        user_id: modelUserId,
        event_type: NOTIFICATION_EVENT.CUSTOM_UPLOADED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: customUploadConfirmedModel(customTitle).title,
        body: customUploadConfirmedModel(customTitle).body,
        entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
        entity_id: `${recordId}:upload_model_confirm`,
        actor_name: modelName,
        _triggerSource: "model_custom_uploaded_api_model",
      }).catch(() => {});
    }

    await notifyAssignedVirtualAssistantCustomUploaded({
      assigned_va_id: existing.assigned_va_id ?? "",
      request_title: customTitle,
      custom_request_id: recordId,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
