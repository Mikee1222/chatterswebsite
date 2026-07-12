"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { hasAnyPermission, hasPermission } from "@/lib/rbac";
import { ROUTES } from "@/lib/routes";
import {
  createWeeklyProgram,
  updateWeeklyProgram,
  deleteWeeklyProgram,
  getWeeklyProgramById,
  checkScheduledShiftConflicts,
} from "@/services/weekly-program";
import type { CreateWeeklyProgramFields } from "@/services/weekly-program";
import { getLastAssignmentBatch } from "@/services/shifts";
import type { LastAssignmentInfo } from "@/services/shifts";
import {
  getTimesForShiftType,
  buildCustomShiftTimes,
  addDays,
  getMondayOfWeek,
  WEEKLY_PROGRAM_DAY_OPTIONS,
  normalizeHHmm,
} from "@/lib/weekly-program";
import type { WeeklyProgramDay, WeeklyProgramShiftType } from "@/types";
import { notifyActiveChattersWeeklyProgramPublished, hasChatterWeeklyProgramPublishedNotification } from "@/services/weekly-program-publish-notify";
import { notify } from "@/services/notification-service";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

async function requireChatterProgramManage() {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.CHATTER_PROGRAM_MANAGE))) return null;
  return user;
}

async function requireChatterProgramRead() {
  const user = await getSessionFromCookies();
  if (
    !user ||
    !(await hasAnyPermission(user, [
      PERMISSIONS.CHATTER_PROGRAM_VIEW,
      PERMISSIONS.CHATTER_PROGRAM_MANAGE,
      PERMISSIONS.SHIFTS_VIEW,
    ]))
  ) {
    return null;
  }
  return user;
}

export async function getLastAssignmentsForChatterAction(
  chatterId: string,
  modelIds: string[]
): Promise<Record<string, LastAssignmentInfo>> {
  if (!(await requireChatterProgramRead())) return {};
  if (!chatterId || modelIds.length === 0) return {};
  const pairs = modelIds.filter(Boolean).map((modelId) => ({ chatterId, modelId }));
  return getLastAssignmentBatch(pairs);
}

export type CreateProgramResult = { success: true; id: string; week_start: string } | { success: false; error: string };
export type UpdateProgramResult = { success: true } | { success: false; error: string };
export type DeleteProgramResult = { success: true } | { success: false; error: string };

export async function createProgramAction(fields: {
  chatter: string[];
  chatter_name: string;
  models: string[];
  day: WeeklyProgramDay;
  shift_type: WeeklyProgramShiftType;
  week_start: string;
  notes?: string;
  modelIdToName?: Record<string, string>;
  custom_start_time?: string;
  custom_end_time?: string;
  /** When true, skip publish notification (caller sends one notify after batch writes). */
  skipPublishNotify?: boolean;
}): Promise<CreateProgramResult> {
  if (!(await requireChatterProgramManage())) {
    return { success: false, error: "Unauthorized" };
  }
  try {
    const weekMonday = getMondayOfWeek(fields.week_start.trim().slice(0, 10));
    const dayIndex = WEEKLY_PROGRAM_DAY_OPTIONS.indexOf(fields.day);
    const dateYmd = addDays(weekMonday, dayIndex);
    let start_time: string;
    let end_time: string;
    if (fields.shift_type === "Custom") {
      const startHHmm = normalizeHHmm(fields.custom_start_time?.trim() ?? "");
      const endHHmm = normalizeHHmm(fields.custom_end_time?.trim() ?? "");
      if (!startHHmm || !endHHmm) {
        return {
          success: false,
          error: "Custom shift requires valid start and end times (HH:mm, hour 00–23, minute 00–59).",
        };
      }
      if (startHHmm === endHHmm) {
        return { success: false, error: "End time cannot equal Start time." };
      }
      const built = buildCustomShiftTimes(dateYmd, startHHmm, endHHmm);
      start_time = built.start_time;
      end_time = built.end_time;
    } else {
      const times = getTimesForShiftType(fields.shift_type, dateYmd);
      start_time = times.start_time;
      end_time = times.end_time;
    }

    const conflict = await checkScheduledShiftConflicts(
      fields.chatter[0] ?? "",
      fields.models,
      fields.day,
      fields.shift_type,
      fields.week_start,
      undefined,
      fields.modelIdToName,
      start_time,
      end_time
    );
    if (conflict.conflict) {
      return { success: false, error: conflict.message };
    }

    const createFields: CreateWeeklyProgramFields = {
      chatter: fields.chatter,
      chatter_name: fields.chatter_name,
      models: fields.models,
      day: fields.day,
      shift_type: fields.shift_type,
      start_time,
      end_time,
      week_start: weekMonday,
      notes: fields.notes ?? "",
    };
    const created = await createWeeklyProgram(createFields);
    revalidatePath(ROUTES.admin.weeklyProgram);
    revalidatePath(ROUTES.chatter.weeklyProgram);
    if (!fields.skipPublishNotify) {
      void notifyActiveChattersWeeklyProgramPublished(weekMonday).catch(() => {});
    }
    return { success: true, id: created.id, week_start: weekMonday };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function updateProgramAction(
  recordId: string,
  fields: {
    chatter?: string[];
    chatter_name?: string;
    models?: string[];
    day?: WeeklyProgramDay;
    shift_type?: WeeklyProgramShiftType;
    week_start?: string;
    notes?: string;
    modelIdToName?: Record<string, string>;
    custom_start_time?: string;
    custom_end_time?: string;
  }
): Promise<UpdateProgramResult> {
  if (!(await requireChatterProgramManage())) {
    return { success: false, error: "Unauthorized" };
  }
  try {
    const existing = await getWeeklyProgramById(recordId);
    if (!existing) return { success: false, error: "Entry not found." };

    const chatterId = fields.chatter?.[0] ?? existing.chatter_id;
    const models = fields.models ?? existing.model_ids;
    const day = fields.day ?? existing.day;
    const shiftType = fields.shift_type ?? existing.shift_type;
    const weekStart = fields.week_start ?? existing.week_start;

    const dayIndex = WEEKLY_PROGRAM_DAY_OPTIONS.indexOf(day);
    const dateYmd = addDays(weekStart, dayIndex);
    let start_time: string;
    let end_time: string;
    if (shiftType === "Custom") {
      const startHHmm = normalizeHHmm(fields.custom_start_time?.trim() ?? "");
      const endHHmm = normalizeHHmm(fields.custom_end_time?.trim() ?? "");
      if (!startHHmm || !endHHmm) {
        return {
          success: false,
          error: "Custom shift requires valid start and end times (HH:mm, hour 00–23, minute 00–59).",
        };
      }
      if (startHHmm === endHHmm) {
        return { success: false, error: "End time cannot equal Start time." };
      }
      const built = buildCustomShiftTimes(dateYmd, startHHmm, endHHmm);
      start_time = built.start_time;
      end_time = built.end_time;
    } else {
      const times = getTimesForShiftType(shiftType, dateYmd);
      start_time = times.start_time;
      end_time = times.end_time;
    }

    const conflict = await checkScheduledShiftConflicts(
      chatterId,
      models,
      day,
      shiftType,
      weekStart,
      recordId,
      fields.modelIdToName,
      start_time,
      end_time
    );
    if (conflict.conflict) {
      return { success: false, error: conflict.message };
    }

    await updateWeeklyProgram(recordId, {
      ...(fields.chatter && { chatter: fields.chatter }),
      ...(fields.chatter_name && { chatter_name: fields.chatter_name }),
      ...(fields.models && { models: fields.models }),
      ...(fields.day && { day: fields.day }),
      ...(fields.shift_type && { shift_type: fields.shift_type }),
      ...(fields.week_start && { week_start: fields.week_start }),
      ...(fields.notes !== undefined && { notes: fields.notes }),
      start_time,
      end_time,
    });
    revalidatePath(ROUTES.admin.weeklyProgram);
    revalidatePath(ROUTES.chatter.weeklyProgram);
    const affectedChatterId = chatterId;
    const weekLabel = weekStart;
    void (async () => {
      const alreadyPublished = await hasChatterWeeklyProgramPublishedNotification(weekStart, existing.chatter_id);
      if (alreadyPublished && affectedChatterId) {
        await notify({
          user_id: affectedChatterId,
          event_type: NOTIFICATION_EVENT.SCHEDULE_UPDATED,
          priority: NOTIFICATION_PRIORITY.NORMAL,
          title: "📆 Schedule updated",
          body: `Your weekly program for ${weekLabel} has been updated. Please check your new schedule.`,
          entity_type: "system",
          entity_id: `weekly_program_corrected:${weekStart}:${recordId}`,
        }).catch(() => {});
      } else {
        await notifyActiveChattersWeeklyProgramPublished(weekStart).catch(() => {});
      }
    })();
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/** Fire-and-forget publish notification after batch writes (e.g. duplicate day). */
export async function notifyChatterWeeklyProgramPublishedAction(weekStart: string): Promise<void> {
  if (!(await requireChatterProgramManage())) return;
  void notifyActiveChattersWeeklyProgramPublished(weekStart).catch(() => {});
}

export async function deleteProgramAction(recordId: string): Promise<DeleteProgramResult> {
  if (!(await requireChatterProgramManage())) {
    return { success: false, error: "Unauthorized" };
  }
  try {
    await deleteWeeklyProgram(recordId);
    revalidatePath(ROUTES.admin.weeklyProgram);
    revalidatePath(ROUTES.chatter.weeklyProgram);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
