"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { deleteCustomRequestRecord, updateCustomRequestAdminStatus } from "@/services/custom-requests";
import { notify, notifyAdmins } from "@/services/notification-service";
import { NOTIFICATION_EVENT, NOTIFICATION_ENTITY, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import type { CustomRequestAdminStatus } from "@/types";

export type UpdateCustomStatusResult = { success: true } | { success: false; error: string };

export async function deleteCustomRequestAction(
  recordId: string
): Promise<UpdateCustomStatusResult> {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    return { success: false, error: "Unauthorized" };
  }
  const id = recordId?.trim();
  if (!id) {
    return { success: false, error: "Missing record id." };
  }
  try {
    await deleteCustomRequestRecord(id);
    revalidatePath(ROUTES.admin.customs);
    revalidatePath(ROUTES.chatter.requestCustom);
    revalidatePath(ROUTES.model.customs);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message || "Delete failed." };
  }
}

export async function updateCustomStatusAction(
  recordId: string,
  admin_status: CustomRequestAdminStatus
): Promise<UpdateCustomStatusResult> {
  try {
    const updated = await updateCustomRequestAdminStatus(recordId, admin_status);
    const customTitle = (updated.request_title ?? "").trim() || "Custom request";
    revalidatePath(ROUTES.admin.customs);
    revalidatePath(ROUTES.chatter.requestCustom);
    revalidatePath(ROUTES.model.customs);
    if (updated.requested_by_chatter_id) {
      try {
        await notify({
          user_id: updated.requested_by_chatter_id,
          event_type: "custom_status_changed",
          priority: "normal",
          title: " Custom updated",
          body: `Status: ${admin_status}.`,
          entity_type: "custom_request",
          entity_id: recordId,
        });
      } catch (e) {
        console.error("[notify] updateCustomStatusAction notify failed", e);
      }
    }
    try {
      await notifyAdmins({
        event_type: NOTIFICATION_EVENT.CUSTOM_REQUEST_UPDATED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: " Custom request updated",
        body: `${customTitle} status changed to ${admin_status}.`,
        entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
        entity_id: recordId,
      });
    } catch (e) {
      console.error("[notify] updateCustomStatusAction notifyAdmins failed", e);
    }
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
