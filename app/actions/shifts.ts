"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth-config";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import {
  createShift,
  updateShift,
  getActiveShifts,
  getActiveVaTaskShift,
  resolveShiftChatterRecordId,
  closeOtherOpenVaTaskShifts,
  listOpenVaTaskShiftsForChatter,
} from "@/services/shifts";
import { selectPreferredVaTaskShift } from "@/services/shifts-supabase";
import { createActivityLog } from "@/services/activity-logs";
import { notify } from "@/services/notification-service";

/** Start a chatting shift (chatter only). */
export async function startChattingShift() {
  const user = await getSessionFromCookies();
  if (!user) return { error: "Not authenticated" };
  if (getEffectiveStaffRole(user) !== "chatter" && !(await hasPermission(user, PERMISSIONS.SHIFTS_MANAGE)))
    return { error: "Only chatters can start chatting shifts" };

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
    title: "🟢 Shift started",
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
    title: "✅ Shift ended",
    body: "Your chatting shift has ended.",
    entity_type: "shift",
    entity_id: myActive.id,
  }).catch(() => {});

  return { success: true };
}

const TASK_SHIFT_TYPE_ALLOWED = new Set(["mistakes", "vault_cleaning", "other"]);

async function canManagePersonalVaTaskShift(user: AuthUser): Promise<boolean> {
  return (
    (await hasPermission(user, PERMISSIONS.VA_TASKS_VIEW)) ||
    (await hasPermission(user, PERMISSIONS.SHIFTS_MANAGE))
  );
}

/** Start a task shift (virtual assistant). shiftType and taskLabel (if type=other) required. */
export async function startTaskShift(formData: FormData) {
  const user = await getSessionFromCookies();
  if (!user) return { error: "Not authenticated" };
  if (!(await canManagePersonalVaTaskShift(user))) {
    return { error: "You do not have permission to start task shifts" };
  }

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
    title: "📋 Task shift started",
    body: `Your task shift has started: ${shiftType}${taskLabel ? ` (${taskLabel})` : ""}.`,
    entity_type: "task_shift",
    entity_id: shift.id,
  }).catch(() => {});

  return { success: true, shiftId: shift.id };
}

/** End the current task shift (virtual assistant). */
export async function endTaskShift() {
  const user = await getSessionFromCookies();
  if (!user) return { error: "Not authenticated" };
  if (!(await canManagePersonalVaTaskShift(user))) {
    return { error: "You do not have permission to end task shifts" };
  }

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
    title: "✅ Task shift ended",
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

/** Start a VA tasks shift (virtual assistant). */
export async function startVaTaskShiftAction() {
  const user = await getSessionFromCookies();
  if (!user) return { error: "Not authenticated" };
  if (!(await canManagePersonalVaTaskShift(user))) {
    return { error: "You do not have permission to start task shifts" };
  }

  const vaId = user.airtableUserId ?? user.id;
  const [chatterRecordId, existing] = await Promise.all([
    resolveShiftChatterRecordId(vaId),
    getActiveVaTaskShift(vaId),
  ]);
  if (existing) {
    return {
      error: "You already have an active task shift",
      shift: {
        id: existing.id,
        start_time: existing.start_time ?? "",
        status: existing.status,
        break_started_at: existing.break_started_at,
        paused_seconds: existing.paused_seconds ?? 0,
        break_minutes: existing.break_minutes ?? 0,
      },
    };
  }

  const now = new Date();
  const startIso = now.toISOString();
  const date = startIso.split("T")[0]!;
  const weekStart = getWeekStart(now);
  const shift = await createShift({
    chatter: chatterRecordId ? [chatterRecordId] : [],
    chatter_name: user.fullName ?? user.email ?? "",
    week_start: weekStart,
    date,
    scheduled_shift: "",
    start_time: startIso,
    status: "active",
    staff_role: "virtual_assistant",
    shift_type: "task",
    task_label: "",
    models_count: 0,
    break_minutes: 0,
    paused_seconds: 0,
  });

  // Collapse older/paused duplicates from parallel Start — never kill a newer row.
  if (chatterRecordId) {
    await closeOtherOpenVaTaskShifts(chatterRecordId, shift.id).catch((err) =>
      console.error("[startVaTaskShift] duplicate cleanup failed", err),
    );
  }

  // Re-read after cleanup so we never hand the client a shift that lost a Start race.
  const preferred = (await getActiveVaTaskShift(vaId)) ?? shift;
  if (preferred.id !== shift.id) {
    // Another concurrent Start won; end our duplicate if still open.
    await updateShift(shift.id, {
      status: "completed",
      end_time: new Date().toISOString(),
      break_started_at: null,
      break_reminder_at: null,
    }).catch((err) => console.error("[startVaTaskShift] self-close lost race failed", err));
  }

  // Activity log can stay fire-and-forget; spawn must be awaited so today's recurring
  // rows materialize before the serverless request freezes (void spawn was dropping work
  // after response — today's checklist stayed locked on virtual "Upcoming day" preview).
  void createActivityLog({
    actor_user_id: user.id,
    actor_name: user.fullName ?? user.email,
    action_type: "task_shift_started",
    entity_type: "shift",
    entity_id: preferred.id,
    summary: `${user.fullName ?? user.email} started a task shift`,
  }).catch((err) => console.error("[task-shift/start] activity log failed", err));

  try {
    const { spawnTodayRecurringOccurrencesForVa } = await import("@/services/va-task-recurring-spawn");
    const spawnResult = await spawnTodayRecurringOccurrencesForVa(vaId);
    if (spawnResult.spawned > 0) {
      console.log(
        `[task-shift/start] spawned ${spawnResult.spawned} today's recurring occurrence(s) for ${vaId}`,
      );
      revalidatePath(ROUTES.va.tasks);
      revalidatePath(ROUTES.va.home);
      revalidatePath(ROUTES.va.schedule);
      revalidatePath(ROUTES.admin.vaTasks);
    }
  } catch (spawnErr) {
    console.error("[task-shift/start] spawn today recurring failed", spawnErr);
  }

  return {
    success: true,
    shiftId: preferred.id,
    shift: {
      id: preferred.id,
      start_time: preferred.start_time ?? startIso,
      status: preferred.status,
      break_started_at: preferred.break_started_at,
      paused_seconds: preferred.paused_seconds ?? 0,
      break_minutes: preferred.break_minutes ?? 0,
    },
  };
}

function serializeVaTaskShift(shift: {
  id: string;
  start_time: string | null;
  status: string;
  break_started_at: string | null;
  paused_seconds?: number;
  break_minutes?: number;
}) {
  return {
    id: shift.id,
    start_time: shift.start_time ?? "",
    status: shift.status,
    break_started_at: shift.break_started_at,
    paused_seconds: shift.paused_seconds ?? 0,
    break_minutes: shift.break_minutes ?? 0,
  };
}

/** Pause VA task shift — maps to on_break; duration counter freezes (active segments only). */
export async function pauseVaTaskShiftAction() {
  const user = await getSessionFromCookies();
  if (!user) return { error: "Not authenticated" };
  if (!(await canManagePersonalVaTaskShift(user))) {
    return { error: "You do not have permission to pause task shifts" };
  }

  const vaId = user.airtableUserId ?? user.id;
  const myActive = await getActiveVaTaskShift(vaId);
  if (!myActive) return { error: "No active task shift found" };
  if (myActive.status === "on_break" || Boolean(myActive.break_started_at?.trim())) {
    return { success: true, shift: serializeVaTaskShift(myActive) };
  }
  if (myActive.status !== "active") {
    return { error: "You can only pause an active task shift." };
  }

  const pauseIso = new Date().toISOString();
  await updateShift(myActive.id, {
    status: "on_break",
    break_started_at: pauseIso,
  });

  return {
    success: true,
    shift: serializeVaTaskShift({
      ...myActive,
      status: "on_break",
      break_started_at: pauseIso,
    }),
  };
}

/** Resume VA task shift — closes open pause into paused_seconds. */
export async function resumeVaTaskShiftAction() {
  const user = await getSessionFromCookies();
  if (!user) return { error: "Not authenticated" };
  if (!(await canManagePersonalVaTaskShift(user))) {
    return { error: "You do not have permission to resume task shifts" };
  }

  const vaId = user.airtableUserId ?? user.id;
  const chatterRecordId = await resolveShiftChatterRecordId(vaId);
  const open = chatterRecordId ? await listOpenVaTaskShiftsForChatter(chatterRecordId) : [];
  const preferredOpen = selectPreferredVaTaskShift(open);
  const healthy =
    preferredOpen &&
    preferredOpen.status === "active" &&
    !preferredOpen.break_started_at?.trim()
      ? preferredOpen
      : open
          .filter((s) => s.status === "active" && !s.break_started_at?.trim())
          .sort((a, b) => (b.start_time || "").localeCompare(a.start_time || ""))[0] ?? null;
  // Dual open rows: keep the healthy active and drop stuck on_break duplicates.
  if (healthy) {
    if (chatterRecordId) {
      await closeOtherOpenVaTaskShifts(chatterRecordId, healthy.id).catch((err) =>
        console.error("[resumeVaTaskShift] duplicate cleanup failed", err),
      );
    }
    return { success: true, shift: serializeVaTaskShift(healthy) };
  }

  const myActive =
    open
      .filter((s) => s.status === "on_break" || Boolean(s.break_started_at?.trim()))
      .sort((a, b) => (b.start_time || "").localeCompare(a.start_time || ""))[0] ??
    preferredOpen ??
    (await getActiveVaTaskShift(vaId));
  if (!myActive) return { error: "No active task shift found" };
  if (myActive.status !== "on_break" && !myActive.break_started_at?.trim()) {
    return { success: true, shift: serializeVaTaskShift(myActive) };
  }

  const now = Date.now();
  let pausedSeconds = Math.max(0, Math.floor(Number(myActive.paused_seconds ?? 0)));
  if (myActive.break_started_at) {
    const startMs = new Date(myActive.break_started_at).getTime();
    if (Number.isFinite(startMs)) {
      pausedSeconds += Math.max(0, Math.floor((now - startMs) / 1000));
    }
  }
  const breakMinutes = Math.ceil(pausedSeconds / 60);

  await updateShift(myActive.id, {
    status: "active",
    break_started_at: null,
    break_reminder_at: null,
    paused_seconds: pausedSeconds,
    break_minutes: breakMinutes,
  });

  if (chatterRecordId) {
    await closeOtherOpenVaTaskShifts(chatterRecordId, myActive.id).catch((err) =>
      console.error("[resumeVaTaskShift] duplicate cleanup failed", err),
    );
  }

  // Re-read so client + subsequent completion gates see cleared pause (not a synthetic object).
  const resumed = await getActiveVaTaskShift(vaId);
  return {
    success: true,
    shift: serializeVaTaskShift(
      resumed ?? {
        ...myActive,
        status: "active",
        break_started_at: null,
        paused_seconds: pausedSeconds,
        break_minutes: breakMinutes,
      },
    ),
  };
}

/** End the current VA tasks shift (virtual assistant). */
export async function endVaTaskShiftAction() {
  const user = await getSessionFromCookies();
  if (!user) return { error: "Not authenticated" };
  if (!(await canManagePersonalVaTaskShift(user))) {
    return { error: "You do not have permission to end task shifts" };
  }

  const vaId = user.airtableUserId ?? user.id;
  const myActive = await getActiveVaTaskShift(vaId);
  if (!myActive) return { error: "No active task shift found" };

  const endTime = new Date();
  const endIso = endTime.toISOString();

  // Finalize any open pause into paused_seconds before completing.
  let pausedSeconds = Math.max(0, Math.floor(Number(myActive.paused_seconds ?? 0)));
  if (myActive.status === "on_break" || Boolean(myActive.break_started_at?.trim())) {
    if (myActive.break_started_at?.trim()) {
      const startMs = new Date(myActive.break_started_at).getTime();
      if (Number.isFinite(startMs)) {
        pausedSeconds += Math.max(0, Math.floor((endTime.getTime() - startMs) / 1000));
      }
    }
  }

  const startMs = myActive.start_time ? new Date(myActive.start_time).getTime() : NaN;
  const wallSeconds = Number.isFinite(startMs)
    ? Math.max(0, Math.floor((endTime.getTime() - startMs) / 1000))
    : 0;
  const activeSeconds = Math.max(0, wallSeconds - pausedSeconds);
  const totalMinutes = Math.max(0, Math.floor(activeSeconds / 60));
  const breakMinutes = Math.ceil(pausedSeconds / 60);

  await updateShift(myActive.id, {
    end_time: endIso,
    status: "completed",
    break_started_at: null,
    break_reminder_at: null,
    paused_seconds: pausedSeconds,
    break_minutes: breakMinutes,
    total_minutes: totalMinutes,
    total_hours_decimal: Math.round((activeSeconds / 3600) * 100) / 100,
  });

  void createActivityLog({
    actor_user_id: user.id,
    actor_name: user.fullName ?? user.email,
    action_type: "task_shift_ended",
    entity_type: "shift",
    entity_id: myActive.id,
    summary: `${user.fullName ?? user.email} ended a task shift`,
  }).catch((err) => console.error("[task-shift/end] activity log failed", err));

  return { success: true };
}
