"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/routes";
import { updateCustomRequestStatus } from "@/services/custom-requests";
import { notify } from "@/services/notification-service";
import type { CustomRequestStatus } from "@/types";

export type UpdateCustomStatusResult = { success: true } | { success: false; error: string };

export async function updateCustomStatusAction(
  recordId: string,
  status: CustomRequestStatus
): Promise<UpdateCustomStatusResult> {
  try {
    const updated = await updateCustomRequestStatus(recordId, status);
    if (updated.chatter_id) {
      await notify({
        user_id: updated.chatter_id,
        event_type: "custom_status_changed",
        priority: "normal",
        title: "Custom request updated",
        body: `Status changed to ${status}.`,
        entity_type: "custom_request",
        entity_id: recordId,
      }).catch(() => {});
    }
    revalidatePath(ROUTES.admin.customs);
    revalidatePath(ROUTES.chatter.requestCustom);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
