"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { revalidateCustomRequestSurfaces } from "@/lib/revalidate-custom-request-paths";
import { ROUTES } from "@/lib/routes";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import {
  deleteCustomRequestRecord,
  getCustomRequestById,
  updateCustomRequestAdminStatus,
} from "@/services/custom-requests";
import { getUserByAirtableId } from "@/services/users";
import { notify, notifyAdmins } from "@/services/notification-service";
import { NOTIFICATION_EVENT, NOTIFICATION_ENTITY, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import type { CustomRequestAdminStatus } from "@/types";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";

export type UpdateCustomStatusResult = { success: true } | { success: false; error: string };

export async function deleteCustomRequestAction(
  recordId: string
): Promise<UpdateCustomStatusResult> {
  const user = await getSessionFromCookies();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }
  const id = recordId?.trim();
  if (!id) {
    return { success: false, error: "Missing record id." };
  }

  const existing = await getCustomRequestById(id);
  if (!existing) {
    return { success: false, error: "Request not found." };
  }

  const role = user.role;
  const staffRole = getEffectiveStaffRole(user);
  const sessionRecordId = (user.airtableUserId ?? user.id)?.trim() ?? "";

  if (await hasPermission(user, PERMISSIONS.CUSTOM_REQUESTS_MANAGE)) {
    // Agency staff may delete any custom request.
  } else if (staffRole === "virtual_assistant" || role === "virtual_assistant") {
    if (existing.admin_status !== "pending") {
      return { success: false, error: "Only pending requests can be deleted." };
    }
  } else if (role === "model") {
    if (existing.admin_status !== "accepted" || existing.model_status !== "waiting_schedule") {
      return { success: false, error: "Only waiting-schedule requests can be deleted." };
    }
    if (!sessionRecordId) {
      return { success: false, error: "Unauthorized" };
    }
    const modelUser = await getUserByAirtableId(sessionRecordId);
    if (!modelUser?.linked_model_id || modelUser.linked_model_id !== existing.assigned_model_id) {
      return { success: false, error: "This request is not assigned to you." };
    }
  } else if (staffRole === "chatter" || role === "chatter") {
    if (existing.admin_status !== "pending" || existing.model_status !== "waiting_schedule") {
      return { success: false, error: "Only pending requests can be deleted." };
    }
    if (!sessionRecordId || existing.requested_by_chatter_id !== sessionRecordId) {
      return { success: false, error: "You can only delete your own requests." };
    }
  } else {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await deleteCustomRequestRecord(id);
    revalidateCustomRequestSurfaces();
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
          title: "📝 Custom updated",
          body: `📝 Status: ${admin_status}.`,
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
        title: "📝 Custom request updated",
        body: `📝 ${customTitle} status changed to ${admin_status}.`,
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
