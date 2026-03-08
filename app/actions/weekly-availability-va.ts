"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { addDays, buildCustomShiftTimes, getMondayOfWeek, WEEKLY_PROGRAM_DAY_OPTIONS } from "@/lib/weekly-program";
import {
  createWeeklyAvailabilityRequestVa,
  getRequestByWeekDayVa,
  getWeeklyAvailabilityRequestVaById,
  getRequestsForWeekVa,
  countDayOffForWeekVa,
  updateWeeklyAvailabilityRequestVa,
} from "@/services/weekly-availability-requests-va";
import type { WeeklyProgramDay, WeeklyProgramShiftType, WeeklyAvailabilityEntryType } from "@/types";

function customTimesToISO(
  weekStart: string,
  day: WeeklyProgramDay,
  startHHmm: string,
  endHHmm: string
): { custom_start_time: string; custom_end_time: string } {
  const dayIndex = WEEKLY_PROGRAM_DAY_OPTIONS.indexOf(day);
  const dateYmd = addDays(weekStart, dayIndex);
  const { start_time, end_time } = buildCustomShiftTimes(dateYmd, startHHmm, endHHmm);
  return { custom_start_time: start_time, custom_end_time: end_time };
}

export type SubmitAvailabilityVaResult =
  | { success: true; id: string }
  | { success: false; error: string };

export async function submitAvailabilityVaAction(fields: {
  week_start: string;
  day: WeeklyProgramDay;
  entry_type: WeeklyAvailabilityEntryType;
  shift_type?: WeeklyProgramShiftType;
  custom_start_time?: string;
  custom_end_time?: string;
  notes?: string;
}): Promise<SubmitAvailabilityVaResult> {
  const user = await getSessionFromCookies();
  if (!user) return { success: false, error: "Not authenticated." };
  if (user.role !== "virtual_assistant") return { success: false, error: "Only virtual assistants can submit VA availability." };

  const vaId = user.airtableUserId ?? user.id;
  const vaName = user.fullName ?? user.email ?? "";
  const weekMonday = getMondayOfWeek(fields.week_start.trim().slice(0, 10));

  const existing = await getRequestByWeekDayVa(weekMonday, vaId, fields.day);
  if (existing) {
    return {
      success: false,
      error: "You already have an entry for that day. Use the Edit button on your submission to change it.",
    };
  }

  if (fields.entry_type === "day_off") {
    const weekRequests = await getRequestsForWeekVa(weekMonday, vaId);
    const dayOffCount = countDayOffForWeekVa(weekRequests);
    if (dayOffCount >= 2) {
      return {
        success: false,
        error: "You can submit at most 2 days off per week. You have already submitted 2.",
      };
    }
  } else {
    if (fields.shift_type === "Custom") {
      const start = fields.custom_start_time?.trim();
      const end = fields.custom_end_time?.trim();
      if (!start || !end) return { success: false, error: "Custom shift requires start and end time." };
      if (start === end) return { success: false, error: "Start and end time cannot be the same." };
    }
  }

  try {
    let customStartTime: string | undefined;
    let customEndTime: string | undefined;
    if (
      fields.entry_type === "availability" &&
      fields.shift_type === "Custom" &&
      fields.custom_start_time?.trim() &&
      fields.custom_end_time?.trim()
    ) {
      const iso = customTimesToISO(
        weekMonday,
        fields.day,
        fields.custom_start_time.trim(),
        fields.custom_end_time.trim()
      );
      customStartTime = iso.custom_start_time;
      customEndTime = iso.custom_end_time;
    }
    const created = await createWeeklyAvailabilityRequestVa({
      week_start: weekMonday,
      chatter: [vaId],
      chatter_name: vaName,
      day: fields.day,
      entry_type: fields.entry_type,
      ...(fields.entry_type === "availability" && {
        shift_type: fields.shift_type ?? "Morning",
        ...(customStartTime && customEndTime && {
          custom_start_time: customStartTime,
          custom_end_time: customEndTime,
        }),
      }),
      notes: fields.notes ?? "",
    });
    revalidatePath(ROUTES.va.weeklyAvailability);
    revalidatePath(ROUTES.admin.weeklyProgramVa);
    return { success: true, id: created.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export type UpdateAvailabilityVaResult =
  | { success: true }
  | { success: false; error: string };

export async function updateAvailabilityVaAction(
  recordId: string,
  fields: {
    entry_type: WeeklyAvailabilityEntryType;
    shift_type?: WeeklyProgramShiftType;
    custom_start_time?: string;
    custom_end_time?: string;
    notes?: string;
  }
): Promise<UpdateAvailabilityVaResult> {
  const user = await getSessionFromCookies();
  if (!user) return { success: false, error: "Not authenticated." };
  if (user.role !== "virtual_assistant") return { success: false, error: "Only virtual assistants can update their availability." };

  const vaId = user.airtableUserId ?? user.id;
  const existing = await getWeeklyAvailabilityRequestVaById(recordId);
  if (!existing) return { success: false, error: "Availability entry not found." };
  if (existing.chatter_id !== vaId) {
    return { success: false, error: "You can only edit your own availability." };
  }

  if (fields.entry_type === "day_off") {
    const weekRequests = await getRequestsForWeekVa(existing.week_start, vaId);
    const dayOffCount = countDayOffForWeekVa(weekRequests, recordId);
    if (dayOffCount >= 2) {
      return {
        success: false,
        error: "You can have at most 2 days off per week. You already have 2 other days off this week.",
      };
    }
  } else {
    if (fields.shift_type === "Custom") {
      const start = fields.custom_start_time?.trim();
      const end = fields.custom_end_time?.trim();
      if (!start || !end) return { success: false, error: "Custom shift requires start and end time." };
      if (start === end) return { success: false, error: "Start and end time cannot be the same." };
    }
  }

  try {
    let customStartTime: string | undefined;
    let customEndTime: string | undefined;
    if (
      fields.entry_type === "availability" &&
      fields.shift_type === "Custom" &&
      fields.custom_start_time?.trim() &&
      fields.custom_end_time?.trim()
    ) {
      const iso = customTimesToISO(
        existing.week_start,
        existing.day,
        fields.custom_start_time.trim(),
        fields.custom_end_time.trim()
      );
      customStartTime = iso.custom_start_time;
      customEndTime = iso.custom_end_time;
    }
    await updateWeeklyAvailabilityRequestVa(recordId, {
      entry_type: fields.entry_type,
      ...(fields.entry_type === "availability" && {
        shift_type: fields.shift_type ?? "Morning",
        ...(customStartTime && customEndTime && {
          custom_start_time: customStartTime,
          custom_end_time: customEndTime,
        }),
      }),
      notes: fields.notes ?? "",
    });
    revalidatePath(ROUTES.va.weeklyAvailability);
    revalidatePath(ROUTES.admin.weeklyProgramVa);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
