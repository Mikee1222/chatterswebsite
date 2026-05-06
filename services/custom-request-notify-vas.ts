"use server";

/**
 * New custom request notifications for active VAs (avoids circular imports with `custom-requests.ts`).
 */

import { customRequestAdmin } from "@/lib/notification-copy";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { notify } from "@/services/notification-service";
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
