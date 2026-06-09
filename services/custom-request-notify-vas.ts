"use server";

/**
 * New custom request notifications for active VAs (avoids circular imports with `custom-requests.ts`).
 */

import { customRequestAdmin } from "@/lib/notification-copy";
import { ROUTES } from "@/lib/routes";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { notify } from "@/services/notification-service";
import { createNotification } from "@/services/notifications";
import { sendPushToUser } from "@/services/push-subscriptions";
import { listAllUsers } from "@/services/users";

export async function notifyActiveVirtualAssistantsCustomCreated(input: {
  chatter_name: string;
  request_title: string;
  model_name: string;
  fan_username?: string;
  entity_id: string;
}): Promise<void> {
  const users = await listAllUsers();
  const vas = users.filter(
    (u) => u.role === "virtual_assistant" && (u.status ?? "").toLowerCase() === "active" && u.id
  );
  const { title, body } = customRequestAdmin(
    input.chatter_name,
    input.request_title,
    input.model_name,
    input.fan_username
  );
  for (const u of vas) {
    await notify({
      user_id: u.id,
      event_type: NOTIFICATION_EVENT.CUSTOM_REQUEST_CREATED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title,
      body,
      entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
      entity_id: input.entity_id,
      actor_name: input.chatter_name,
      _triggerSource: "notifyActiveVirtualAssistantsCustomCreated",
    }).catch((e) => console.error("[notify] VA custom_request_created failed", e));
  }
}

/** When deliverables are uploaded, notify the VA linked on `custom_requests.assigned_va` (if any). */
export async function notifyAssignedVirtualAssistantCustomUploaded(input: {
  assigned_va_id: string;
  request_title: string;
  custom_request_id: string;
  actor_name?: string;
}): Promise<void> {
  const vaId = input.assigned_va_id?.trim();
  if (!vaId) return;
  const customTitle = (input.request_title || "Custom request").trim() || "Custom request";
  const actorPrefix = input.actor_name?.trim() ? `${input.actor_name.trim()} uploaded ` : "Uploaded ";
  const title = "✅ Custom request uploaded";
  const body = `✅ ${actorPrefix}“${customTitle}”.`;
  await createNotification({
    user_id: vaId,
    category: "custom_request",
    event_type: NOTIFICATION_EVENT.CUSTOM_REQUEST_UPLOADED,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title,
    body,
    entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
    entity_id: input.custom_request_id,
  }).catch((e) => console.error("[notify] VA custom_request_uploaded failed", e));
  await sendPushToUser(vaId, {
    title,
    body,
    url: ROUTES.va.customRequests,
  }).catch((e) => console.error("[push] VA custom_request_uploaded failed", e));
}
