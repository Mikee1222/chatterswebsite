"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getUserByAirtableId } from "@/services/users";
import {
  getCustomRequestById,
  updateCustomRequestModelSchedule,
} from "@/services/custom-requests";
import type { CustomRequestModelStatus } from "@/types";

export type ModelCustomUpdateResult = { success: true } | { success: false; error: string };

function isModelStatus(v: string): v is CustomRequestModelStatus {
  return (
    v === "waiting_schedule" ||
    v === "scheduled" ||
    v === "in_progress" ||
    v === "completed" ||
    v === "uploaded" ||
    v === "declined");
}

async function linkedModelIdForModelSession(): Promise<string | null> {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "model") return null;
  const recordId = (session.airtableUserId ?? session.id)?.trim();
  if (!recordId) return null;
  const user = await getUserByAirtableId(recordId);
  if (!user?.linked_model_id) return null;
  return user.linked_model_id;
}

/**
 * Model updates notes and (when the request is admin-accepted) workflow status on a custom assigned to them.
 */
export async function updateMyModelCustomRequestAction(
  recordId: string,
  model_notes: string,
  model_status: string
): Promise<ModelCustomUpdateResult> {
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

  const statusOk = isModelStatus(model_status);
  if (!statusOk) return { success: false, error: "Invalid status." };

  const notes = model_notes.trim();
  const canChangeStatus = existing.admin_status === "accepted";

  try {
    await updateCustomRequestModelSchedule(id, {
      model_notes: notes,
      ...(canChangeStatus ? { model_status: model_status as CustomRequestModelStatus } : {}),
    });
    revalidatePath(ROUTES.model.customs);
    revalidatePath(ROUTES.model.home);
    revalidatePath(ROUTES.chatter.requestCustom);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message || "Update failed." };
  }
}
