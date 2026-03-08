"use server";

import { getSessionFromCookies } from "@/lib/auth";
import { createShift, updateShift, getActiveShifts } from "@/services/shifts";
import { createActivityLog } from "@/services/activity-logs";
import { notify } from "@/services/notification-service";

/** Start a chatting shift (chatter only). */
export async function startChattingShift() {
  const user = await getSessionFromCookies();
  if (!user) return { error: "Not authenticated" };
  if (user.role !== "chatter" && user.role !== "admin") return { error: "Only chatters can start chatting shifts" };

  const active = await getActiveShifts("chatter");
  const myActive = active.find((s) => s.chatter_id === user.airtableUserId);
  if (myActive) return { error: "You already have an active shift" };

  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const weekStart = getWeekStart(now);
  const shift = await createShift({
    chatter: user.airtableUserId ? [user.airtableUserId] : [],
    chatter_name: user.fullName ?? user.email ?? "",
    week_start: weekStart,
    date,
    scheduled_shift: "",
    start_time: now.toISOString(),
    status: "active",
    staff_role: "chatter",
    shift_type: "chatting",
    task_label: "",
    models_count: 0,
  });

  await createActivityLog({
    actor_user_id: user.id,
    actor_name: user.fullName ?? user.email,
    action_type: "shift_started",
    entity_type: "shift",
    entity_id: shift.id,
    summary: `${user.fullName ?? user.email} started a chatting shift`,
  });

  const userId = user.airtableUserId ?? user.id;
  await notify({
    user_id: userId,
    event_type: "shift_started",
    priority: "normal",
    title: "Shift started",
    body: "Your chatting shift has started.",
    entity_type: "shift",
    entity_id: shift.id,
  }).catch(() => {});

  return { success: true, shiftId: shift.id };
}

/** End the current chatting shift (chatter). */
export async function endChattingShift() {
  const user = await getSessionFromCookies();
  if (!user) return { error: "Not authenticated" };

  const active = await getActiveShifts("chatter");
  const myActive = active.find((s) => s.chatter_id === user.airtableUserId);
  if (!myActive) return { error: "No active shift found" };

  const endTime = new Date().toISOString();

  await updateShift(myActive.id, {
    end_time: endTime,
    status: "completed",
  });

  await createActivityLog({
    actor_user_id: user.id,
    actor_name: user.fullName ?? user.email,
    action_type: "shift_ended",
    entity_type: "shift",
    entity_id: myActive.id,
    summary: `${user.fullName ?? user.email} ended a chatting shift`,
  });

  const userId = user.airtableUserId ?? user.id;
  await notify({
    user_id: userId,
    event_type: "shift_ended",
    priority: "normal",
    title: "Shift ended",
    body: "Your chatting shift has ended.",
    entity_type: "shift",
    entity_id: myActive.id,
  }).catch(() => {});

  return { success: true };
}

const TASK_SHIFT_TYPE_ALLOWED = new Set(["mistakes", "vault_cleaning", "other"]);

/** Start a task shift (virtual assistant). shiftType and taskLabel (if type=other) required. */
export async function startTaskShift(formData: FormData) {
  const user = await getSessionFromCookies();
  if (!user) return { error: "Not authenticated" };
  if (user.role !== "virtual_assistant" && user.role !== "admin") return { error: "Only virtual assistants can start task shifts" };

  let shiftType = (formData.get("shift_type") as string)?.trim();
  let taskLabel = (formData.get("task_label") as string)?.trim();
  const notes = (formData.get("notes") as string)?.trim();

  if (typeof shiftType === "string" && shiftType.length >= 2 && shiftType.startsWith('"') && shiftType.endsWith('"')) {
    try {
      const parsed = JSON.parse(shiftType);
      if (typeof parsed === "string") shiftType = parsed;
    } catch {
      /* keep as-is */
    }
  }
  if (typeof taskLabel === "string" && taskLabel.length >= 2 && taskLabel.startsWith('"') && taskLabel.endsWith('"')) {
    try {
      const parsed = JSON.parse(taskLabel);
      if (typeof parsed === "string") taskLabel = parsed;
    } catch {
      /* keep as-is */
    }
  }

  if (!shiftType) return { error: "Shift type is required" };
  if (!TASK_SHIFT_TYPE_ALLOWED.has(shiftType)) {
    return { error: "Shift type must be one of: " + [...TASK_SHIFT_TYPE_ALLOWED].join(", ") };
  }
  if (shiftType === "other" && !taskLabel) return { error: "Task label is required when type is Other" };

  const active = await getActiveShifts("virtual_assistant");
  const myActive = active.find((s) => s.chatter_id === user.airtableUserId);
  if (myActive) return { error: "You already have an active task shift" };

  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const weekStart = getWeekStart(now);
  const shift = await createShift({
    chatter: user.airtableUserId ? [user.airtableUserId] : [],
    chatter_name: user.fullName ?? user.email ?? "",
    week_start: weekStart,
    date,
    scheduled_shift: "",
    start_time: now.toISOString(),
    status: "active",
    staff_role: "virtual_assistant",
    shift_type: shiftType as "mistakes" | "vault_cleaning" | "other",
    ...(shiftType === "other" && taskLabel ? { task_label: taskLabel } : {}),
    notes: notes || "",
    models_count: 0,
  });

  await createActivityLog({
    actor_user_id: user.id,
    actor_name: user.fullName ?? user.email,
    action_type: "task_shift_started",
    entity_type: "shift",
    entity_id: shift.id,
    summary: `${user.fullName ?? user.email} started task shift: ${shiftType}${taskLabel ? ` (${taskLabel})` : ""}`,
  });

  const userId = user.airtableUserId ?? user.id;
  await notify({
    user_id: userId,
    event_type: "task_started",
    priority: "normal",
    title: "Task shift started",
    body: `Task shift: ${shiftType}${taskLabel ? ` (${taskLabel})` : ""}`,
    entity_type: "task_shift",
    entity_id: shift.id,
  }).catch(() => {});

  return { success: true, shiftId: shift.id };
}

/** End the current task shift (virtual assistant). */
export async function endTaskShift() {
  const user = await getSessionFromCookies();
  if (!user) return { error: "Not authenticated" };

  const active = await getActiveShifts("virtual_assistant");
  const myActive = active.find((s) => s.chatter_id === user.airtableUserId);
  if (!myActive) return { error: "No active task shift found" };

  const endTime = new Date().toISOString();

  await updateShift(myActive.id, {
    end_time: endTime,
    status: "completed",
  });

  await createActivityLog({
    actor_user_id: user.id,
    actor_name: user.fullName ?? user.email,
    action_type: "task_shift_ended",
    entity_type: "shift",
    entity_id: myActive.id,
    summary: `${user.fullName ?? user.email} ended task shift`,
  });

  const userId = user.airtableUserId ?? user.id;
  await notify({
    user_id: userId,
    event_type: "task_finished",
    priority: "normal",
    title: "Task shift ended",
    body: "Your task shift has ended.",
    entity_type: "task_shift",
    entity_id: myActive.id,
  }).catch(() => {});

  return { success: true };
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}
