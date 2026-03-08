"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/routes";
import {
  createWeeklyProgramVa,
  updateWeeklyProgramVa,
  deleteWeeklyProgramVa,
  getWeeklyProgramVaById,
  checkScheduledShiftConflictsVa,
} from "@/services/weekly-program-va";
import type { CreateWeeklyProgramVaFields } from "@/services/weekly-program-va";
import { getTimesForShiftType, buildCustomShiftTimes, addDays, getMondayOfWeek, WEEKLY_PROGRAM_DAY_OPTIONS } from "@/lib/weekly-program";
import type { WeeklyProgramDay, WeeklyProgramShiftType } from "@/types";

export type CreateProgramVaResult = { success: true; id: string; week_start: string } | { success: false; error: string };
export type UpdateProgramVaResult = { success: true } | { success: false; error: string };
export type DeleteProgramVaResult = { success: true } | { success: false; error: string };

export async function createProgramVaAction(fields: {
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
}): Promise<CreateProgramVaResult> {
  try {
    const weekMonday = getMondayOfWeek(fields.week_start.trim().slice(0, 10));
    const dayIndex = WEEKLY_PROGRAM_DAY_OPTIONS.indexOf(fields.day);
    const dateYmd = addDays(weekMonday, dayIndex);
    let start_time: string;
    let end_time: string;
    if (fields.shift_type === "Custom") {
      const startHHmm = fields.custom_start_time?.trim();
      const endHHmm = fields.custom_end_time?.trim();
      if (!startHHmm || !endHHmm) {
        return { success: false, error: "Custom shift requires Start time and End time." };
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

    const conflict = await checkScheduledShiftConflictsVa(
      fields.chatter[0] ?? "",
      fields.models,
      fields.day,
      fields.shift_type,
      weekMonday,
      undefined,
      fields.modelIdToName,
      start_time,
      end_time
    );
    if (conflict.conflict) {
      return { success: false, error: conflict.message };
    }

    const createFields: CreateWeeklyProgramVaFields = {
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
    const created = await createWeeklyProgramVa(createFields);
    revalidatePath(ROUTES.admin.weeklyProgramVa);
    revalidatePath(ROUTES.va.weeklyProgram);
    return { success: true, id: created.id, week_start: weekMonday };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function updateProgramVaAction(
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
): Promise<UpdateProgramVaResult> {
  try {
    const existing = await getWeeklyProgramVaById(recordId);
    if (!existing) return { success: false, error: "Entry not found." };

    const vaId = fields.chatter?.[0] ?? existing.chatter_id;
    const models = fields.models ?? existing.model_ids;
    const day = fields.day ?? existing.day;
    const shiftType = fields.shift_type ?? existing.shift_type;
    const weekStart = fields.week_start ?? existing.week_start;

    const dayIndex = WEEKLY_PROGRAM_DAY_OPTIONS.indexOf(day);
    const dateYmd = addDays(weekStart, dayIndex);
    let start_time: string;
    let end_time: string;
    if (shiftType === "Custom") {
      const startHHmm = fields.custom_start_time?.trim();
      const endHHmm = fields.custom_end_time?.trim();
      if (!startHHmm || !endHHmm) {
        return { success: false, error: "Custom shift requires Start time and End time." };
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

    const conflict = await checkScheduledShiftConflictsVa(
      vaId,
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

    await updateWeeklyProgramVa(recordId, {
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
    revalidatePath(ROUTES.admin.weeklyProgramVa);
    revalidatePath(ROUTES.va.weeklyProgram);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function deleteProgramVaAction(recordId: string): Promise<DeleteProgramVaResult> {
  try {
    await deleteWeeklyProgramVa(recordId);
    revalidatePath(ROUTES.admin.weeklyProgramVa);
    revalidatePath(ROUTES.va.weeklyProgram);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
