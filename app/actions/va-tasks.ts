"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { ROUTES } from "@/lib/routes";
import { getNotificationUserId } from "@/lib/notification-user";
import { notify, notifyAdmins } from "@/services/notification-service";
import { NOTIFICATION_EVENT, NOTIFICATION_ENTITY, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { vaTaskAssigned } from "@/lib/notification-copy";
import {
  createVaTask,
  updateVaTask,
  deleteVaTask,
  getVaTaskById,
  type VaTaskCreateInput,
  type VaTaskUpdateInput,
} from "@/services/va-tasks";
import { getActiveVaTaskShift } from "@/services/shifts";
import { isVirtualVaTaskId, shouldSpawnRecurring } from "@/lib/recurrence";
import { spawnNextRecurringOccurrenceAfterComplete } from "@/services/va-task-recurring-spawn";
import {
  applyRecurringDeleteScope,
  applyRecurringEditScope,
} from "@/services/va-task-recurring-scope";
import type { RecurringOccurrenceScope } from "@/lib/recurring-occurrence-scope";
import type { VaTaskRecord, VaTaskStatus } from "@/types";
import { shouldUsePersonalVaTasksNav } from "@/lib/nav-config";
import { getUserPermissions, hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";

export type { RecurringOccurrenceScope };

export type VaTaskActionResult = { success: true; task?: VaTaskRecord } | { success: false; error: string };

function revalidateVaTaskPaths() {
  revalidatePath(ROUTES.admin.vaTasks);
  revalidatePath(ROUTES.va.tasks);
  revalidatePath(ROUTES.va.home);
  revalidatePath(ROUTES.va.schedule);
}

export async function createVaTaskAction(input: VaTaskCreateInput): Promise<VaTaskActionResult> {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.VA_TASKS_MANAGE))) return { success: false, error: "Unauthorized." };

  const actorId = getNotificationUserId(user) ?? user.airtableUserId ?? user.id;
  if (!input.title?.trim()) return { success: false, error: "Title is required." };

  try {
    const task = await createVaTask({
      ...input,
      assigned_by_ids: input.assigned_by_ids?.length ? input.assigned_by_ids : actorId ? [actorId] : [],
    });
    revalidateVaTaskPaths();
    await notifyVaTaskAssigned(task, actorId, user.fullName);
    return { success: true, task };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Create failed." };
  }
}

/** Notify each assigned VA that a new task was assigned to them (C2). Never throws. */
async function notifyVaTaskAssigned(
  task: VaTaskRecord,
  actorId?: string | null,
  actorName?: string | null
): Promise<void> {
  const recipients = (task.assigned_to_ids ?? []).filter((uid) => uid && uid !== actorId);
  if (recipients.length === 0) return;
  const copy = vaTaskAssigned(task.title ?? "");
  await Promise.all(
    recipients.map((uid) =>
      notify({
        user_id: uid,
        event_type: NOTIFICATION_EVENT.VA_TASK_ASSIGNED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: copy.title,
        body: copy.body,
        entity_type: NOTIFICATION_ENTITY.VA_TASK,
        entity_id: task.id,
        actor_user_id: actorId ?? undefined,
        actor_name: actorName ?? undefined,
        _triggerSource: "create_va_task",
      }).catch((err) => {
        console.error("[va_task_assigned] notify failed", err);
      })
    )
  );
}

export async function updateVaTaskAction(id: string, data: VaTaskUpdateInput): Promise<VaTaskActionResult> {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.VA_TASKS_MANAGE))) return { success: false, error: "Unauthorized." };
  if (isVirtualVaTaskId(id)) {
    return {
      success: false,
      error: "Use the recurring edit scope action for projected occurrences.",
    };
  }
  try {
    await updateVaTask(id, data);
    revalidateVaTaskPaths();
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Update failed." };
  }
}

export type RecurringVaTaskEditResult =
  | { success: true; targetTaskId: string; materialized: boolean }
  | { success: false; error: string };

/** Edit a recurring task with calendar scope (this occurrence vs this and future). */
export async function updateRecurringVaTaskAction(input: {
  taskId: string;
  scope: RecurringOccurrenceScope;
  data: VaTaskUpdateInput;
  /** For virtual ids — client must pass the projected task snapshot fields via taskPayload. */
  taskPayload?: VaTaskRecord;
}): Promise<RecurringVaTaskEditResult> {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.VA_TASKS_MANAGE))) {
    return { success: false, error: "Unauthorized." };
  }

  try {
    let task: VaTaskRecord | null = null;
    if (isVirtualVaTaskId(input.taskId) || input.taskPayload?.is_virtual_occurrence) {
      task = input.taskPayload ?? null;
      if (!task || task.id !== input.taskId) {
        return { success: false, error: "Projected occurrence payload is required." };
      }
    } else {
      task = await getVaTaskById(input.taskId);
    }
    if (!task) return { success: false, error: "Task not found." };
    if (!task.is_recurring && !task.is_virtual_occurrence) {
      return { success: false, error: "Task is not part of a recurring series." };
    }

    const result = await applyRecurringEditScope({
      task,
      scope: input.scope,
      data: input.data,
    });
    revalidateVaTaskPaths();
    return { success: true, targetTaskId: result.targetTaskId, materialized: result.materialized };
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
  if (!user) return { success: false, error: "Unauthorized." };
  const perms = await getUserPermissions(user);
  const canUpdatePersonal =
    getEffectiveStaffRole(user) === "virtual_assistant" ||
    shouldUsePersonalVaTasksNav(user.role, perms);
  if (!canUpdatePersonal)
    return { success: false, error: "Only assigned users can update task status here." };

  const vaId = getNotificationUserId(user) ?? user.airtableUserId ?? user.id;
  if (!vaId) return { success: false, error: "Missing user id." };

  const task = await getVaTaskById(input.taskId);
  if (!task) return { success: false, error: "Task not found." };

  const visible = task.assigned_to_ids.length === 0 || task.assigned_to_ids.includes(vaId);
  if (!visible) return { success: false, error: "This task is not assigned to you." };

  // A8: gate completion behind an active (non-paused) task shift.
  if (input.status === "done") {
    const activeShift = await getActiveVaTaskShift(user.airtableUserId ?? user.id);
    if (!activeShift) {
      return { success: false, error: "Start your task shift before marking tasks done." };
    }
    if (activeShift.status === "on_break" || Boolean(activeShift.break_started_at?.trim())) {
      return { success: false, error: "Resume your task shift before marking tasks done." };
    }
  }

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

    if (input.status === "done" && shouldSpawnRecurring(task)) {
      try {
        await spawnNextRecurringOccurrenceAfterComplete(task);
      } catch (spawnErr) {
        console.error("[va-tasks] spawn next occurrence failed", spawnErr);
      }
    }

    revalidateVaTaskPaths();

    if (input.status === "done") {
      const vaName = user.fullName?.trim() || user.email?.trim() || "VA";
      await notifyAdmins({
        event_type: NOTIFICATION_EVENT.TASK_COMPLETED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: "✅ VA task completed",
        body: `${vaName} completed the task "${task.title}".`,
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
  if (!user || !(await hasPermission(user, PERMISSIONS.VA_TASKS_MANAGE))) return { success: false, error: "Unauthorized." };
  if (isVirtualVaTaskId(id)) {
    return {
      success: false,
      error: "Use the recurring delete scope action for projected occurrences.",
    };
  }
  try {
    await deleteVaTask(id);
    revalidateVaTaskPaths();
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Delete failed." };
  }
}

/** Delete a recurring task with calendar scope (this occurrence vs this and future). */
export async function deleteRecurringVaTaskAction(input: {
  taskId: string;
  scope: RecurringOccurrenceScope;
  taskPayload?: VaTaskRecord;
}): Promise<VaTaskActionResult> {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.VA_TASKS_MANAGE))) {
    return { success: false, error: "Unauthorized." };
  }

  try {
    let task: VaTaskRecord | null = null;
    if (isVirtualVaTaskId(input.taskId) || input.taskPayload?.is_virtual_occurrence) {
      task = input.taskPayload ?? null;
      if (!task || task.id !== input.taskId) {
        return { success: false, error: "Projected occurrence payload is required." };
      }
    } else {
      task = await getVaTaskById(input.taskId);
    }
    if (!task) return { success: false, error: "Task not found." };
    if (!task.is_recurring && !task.is_virtual_occurrence) {
      return { success: false, error: "Task is not part of a recurring series." };
    }

    await applyRecurringDeleteScope({ task, scope: input.scope });
    revalidateVaTaskPaths();
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Delete failed." };
  }
}
