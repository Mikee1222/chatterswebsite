"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { addDays, buildCustomShiftTimes, getMondayOfWeek, WEEKLY_PROGRAM_DAY_OPTIONS } from "@/lib/weekly-program";
import {
  createWeeklyAvailabilityRequest,
  getRequestByWeekDayChatter,
  getWeeklyAvailabilityRequestById,
  getRequestsForWeek,
  countDayOffForWeek,
  updateWeeklyAvailabilityRequest,
} from "@/services/weekly-availability-requests";
import type { WeeklyProgramDay, WeeklyProgramShiftType, WeeklyAvailabilityEntryType } from "@/types";

/** Convert (week_start, day, HH:mm start, HH:mm end) to full ISO datetimes for Airtable. Handles overnight (end < start = next day). */
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

export type SubmitAvailabilityResult =
  | { success: true; id: string }
  | { success: false; error: string };

export async function submitAvailabilityAction(fields: {
  week_start: string;
  day: WeeklyProgramDay;
  entry_type: WeeklyAvailabilityEntryType;
  shift_type?: WeeklyProgramShiftType;
  custom_start_time?: string;
  custom_end_time?: string;
  notes?: string;
}): Promise<SubmitAvailabilityResult> {
  const user = await getSessionFromCookies();
  if (!user) return { success: false, error: "Not authenticated." };
  if (user.role !== "chatter") return { success: false, error: "Only chatters can submit availability." };

  const chatterId = user.airtableUserId ?? user.id;
  const chatterName = user.fullName ?? user.email ?? "";
  const weekMonday = getMondayOfWeek(fields.week_start.trim().slice(0, 10));

  const existing = await getRequestByWeekDayChatter(weekMonday, chatterId, fields.day);
  if (existing) {
    return {
      success: false,
      error: "You already have an entry for that day. Use the Edit button on your submission to change it.",
    };
  }

  if (fields.entry_type === "day_off") {
    const weekRequests = await getRequestsForWeek(weekMonday, chatterId);
    const dayOffCount = countDayOffForWeek(weekRequests);
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
    const created = await createWeeklyAvailabilityRequest({
      week_start: weekMonday,
      chatter: [chatterId],
      chatter_name: chatterName,
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
    revalidatePath(ROUTES.chatter.weeklyAvailability);
    revalidatePath(ROUTES.admin.weeklyProgram);
    return { success: true, id: created.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export type UpdateAvailabilityResult =
  | { success: true }
  | { success: false; error: string };

export async function updateAvailabilityAction(
  recordId: string,
  fields: {
    entry_type: WeeklyAvailabilityEntryType;
    shift_type?: WeeklyProgramShiftType;
    custom_start_time?: string;
    custom_end_time?: string;
    notes?: string;
  }
): Promise<UpdateAvailabilityResult> {
  const user = await getSessionFromCookies();
  if (!user) return { success: false, error: "Not authenticated." };
  if (user.role !== "chatter") return { success: false, error: "Only chatters can update their availability." };

  const chatterId = user.airtableUserId ?? user.id;
  const existing = await getWeeklyAvailabilityRequestById(recordId);
  if (!existing) return { success: false, error: "Availability entry not found." };
  if (existing.chatter_id !== chatterId) {
    return { success: false, error: "You can only edit your own availability." };
  }

  if (fields.entry_type === "day_off") {
    const weekRequests = await getRequestsForWeek(existing.week_start, chatterId);
    const dayOffCount = countDayOffForWeek(weekRequests, recordId);
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
    await updateWeeklyAvailabilityRequest(recordId, {
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
    revalidatePath(ROUTES.chatter.weeklyAvailability);
    revalidatePath(ROUTES.admin.weeklyProgram);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
