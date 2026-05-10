"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { ROUTES } from "@/lib/routes";
import { getNotificationUserId } from "@/lib/notification-user";
import { notifyAdmins } from "@/services/notification-service";
import { NOTIFICATION_EVENT, NOTIFICATION_ENTITY, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import {
  createVaTask,
  updateVaTask,
  deleteVaTask,
  getVaTaskById,
  type VaTaskCreateInput,
  type VaTaskUpdateInput,
} from "@/services/va-tasks";
import type { VaTaskStatus } from "@/types";

function isAdminLike(role: string | undefined) {
  return role === "admin" || role === "manager";
}

export type VaTaskActionResult = { success: true } | { success: false; error: string };

export async function createVaTaskAction(input: VaTaskCreateInput): Promise<VaTaskActionResult> {
  const user = await getSessionFromCookies();
  if (!user || !isAdminLike(user.role)) return { success: false, error: "Unauthorized." };

  const actorId = getNotificationUserId(user) ?? user.airtableUserId ?? user.id;
  if (!input.title?.trim()) return { success: false, error: "Title is required." };

  try {
    await createVaTask({
      ...input,
      assigned_by_ids: input.assigned_by_ids?.length ? input.assigned_by_ids : actorId ? [actorId] : [],
    });
    revalidatePath(ROUTES.admin.vaTasks);
    revalidatePath(ROUTES.va.tasks);
    revalidatePath(ROUTES.va.home);
    revalidatePath(ROUTES.va.schedule);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Create failed." };
  }
}

export async function updateVaTaskAction(id: string, data: VaTaskUpdateInput): Promise<VaTaskActionResult> {
  const user = await getSessionFromCookies();
  if (!user || !isAdminLike(user.role)) return { success: false, error: "Unauthorized." };
  try {
    await updateVaTask(id, data);
    revalidatePath(ROUTES.admin.vaTasks);
    revalidatePath(ROUTES.va.tasks);
    revalidatePath(ROUTES.va.home);
    revalidatePath(ROUTES.va.schedule);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Update failed." };
  }
}

export async function updateVaTaskStatusAction(input: {
  taskId: string;
  status: VaTaskStatus;
  completed_notes?: string;
}): Promise<VaTaskActionResult> {
  const user = await getSessionFromCookies();
  if (!user || getEffectiveStaffRole(user) !== "virtual_assistant")
    return { success: false, error: "Only VAs can update task status here." };

  const vaId = getNotificationUserId(user) ?? user.airtableUserId ?? user.id;
  if (!vaId) return { success: false, error: "Missing user id." };

  const task = await getVaTaskById(input.taskId);
  if (!task) return { success: false, error: "Task not found." };

  const visible = task.assigned_to_ids.length === 0 || task.assigned_to_ids.includes(vaId);
  if (!visible) return { success: false, error: "This task is not assigned to you." };

  const notes = (input.completed_notes ?? "").trim();
  const patch: VaTaskUpdateInput = {
    status: input.status,
    completed_notes: notes || task.completed_notes,
  };
  if (input.status === "done") {
    patch.completed_at = new Date().toISOString();
  } else if (input.status === "pending" || input.status === "in_progress") {
    patch.completed_at = null;
  }

  try {
    await updateVaTask(input.taskId, patch);
    revalidatePath(ROUTES.va.tasks);
    revalidatePath(ROUTES.va.home);
    revalidatePath(ROUTES.va.schedule);
    revalidatePath(ROUTES.admin.vaTasks);

    if (input.status === "done") {
      const vaName = user.fullName?.trim() || user.email?.trim() || "VA";
      await notifyAdmins({
        event_type: NOTIFICATION_EVENT.TASK_COMPLETED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: "VA task completed",
        body: `✅ Task completed: ${task.title} by ${vaName}`,
        entity_type: NOTIFICATION_ENTITY.VA_TASK,
        entity_id: `va_task_done:${input.taskId}:${Date.now()}`,
      }).catch((e) => console.error("[notify] va_task_completed failed", e));
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Update failed." };
  }
}

export async function deleteVaTaskAction(id: string): Promise<VaTaskActionResult> {
  const user = await getSessionFromCookies();
  if (!user || !isAdminLike(user.role)) return { success: false, error: "Unauthorized." };
  try {
    await deleteVaTask(id);
    revalidatePath(ROUTES.admin.vaTasks);
    revalidatePath(ROUTES.va.tasks);
    revalidatePath(ROUTES.va.home);
    revalidatePath(ROUTES.va.schedule);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Delete failed." };
  }
}
