"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { ROUTES } from "@/lib/routes";
import { addDays, buildCustomShiftTimes, getMondayOfWeek, normalizeHHmm, WEEKLY_PROGRAM_DAY_OPTIONS } from "@/lib/weekly-program";
import { rangesOverlap } from "@/lib/weekly-program-conflicts";
import { notify, notifyAdmins } from "@/services/notification-service";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { formSubmittedAdmin } from "@/lib/notification-copy";
import {
  createWeeklyAvailabilityRequestVa,
  getRequestsByWeekDayVa,
  getWeeklyAvailabilityRequestVaById,
  getRequestsForWeekVa,
  countDayOffForWeekVa,
  updateWeeklyAvailabilityRequestVa,
  deleteWeeklyAvailabilityRequestVa,
} from "@/services/weekly-availability-requests-va";
import type { WeeklyProgramDay, WeeklyProgramShiftType, WeeklyAvailabilityEntryType, WeeklyAvailabilityRequest } from "@/types";

function timesForAvailability(
  weekStart: string,
  day: WeeklyProgramDay,
  shiftType: WeeklyProgramShiftType,
  customStart?: string,
  customEnd?: string
): { start_time: string; end_time: string } | { error: string } {
  const dayIndex = WEEKLY_PROGRAM_DAY_OPTIONS.indexOf(day);
  const dateYmd = addDays(weekStart, dayIndex);
  if (shiftType === "Custom") {
    const start = normalizeHHmm(customStart?.trim() ?? "");
    const end = normalizeHHmm(customEnd?.trim() ?? "");
    if (!start || !end) return { error: "Custom shift requires start and end time." };
    if (start === end) return { error: "Start and end time cannot be the same." };
    return buildCustomShiftTimes(dateYmd, start, end);
  }
  return buildCustomShiftTimes(dateYmd, shiftType === "Morning" ? "12:00" : "20:00", shiftType === "Morning" ? "20:00" : "03:00");
}

function timesForExistingRequest(request: WeeklyAvailabilityRequest): { start_time: string; end_time: string } | null {
  if (request.entry_type !== "availability") return null;
  if (request.shift_type === "Custom") {
    if (!request.custom_start_time || !request.custom_end_time) return null;
    return {
      start_time: request.custom_start_time,
      end_time: request.custom_end_time,
    };
  }
  if (!request.week_start) return null;
  const computed = timesForAvailability(request.week_start, request.day, request.shift_type);
  return "error" in computed ? null : computed;
}

async function validateVaDayAvailabilityRequest(params: {
  weekStart: string;
  vaId: string;
  day: WeeklyProgramDay;
  entryType: WeeklyAvailabilityEntryType;
  shiftType?: WeeklyProgramShiftType;
  customStart?: string;
  customEnd?: string;
  excludeRecordId?: string;
}): Promise<{ ok: true; customStartTime?: string; customEndTime?: string } | { ok: false; error: string }> {
  const existingForDay = (await getRequestsByWeekDayVa(params.weekStart, params.vaId, params.day)).filter(
    (r) => r.id !== params.excludeRecordId
  );

  if (params.entryType === "day_off") {
    if (existingForDay.length > 0) {
      return { ok: false, error: "You already marked this day as day off or submitted availability for it." };
    }
    return { ok: true };
  }

  if (existingForDay.some((r) => r.entry_type === "day_off")) {
    return { ok: false, error: "You already marked this day as day off." };
  }

  const shiftType = params.shiftType ?? "Morning";
  const newTimes = timesForAvailability(params.weekStart, params.day, shiftType, params.customStart, params.customEnd);
  if ("error" in newTimes) return { ok: false, error: newTimes.error };

  for (const existing of existingForDay) {
    const existingTimes = timesForExistingRequest(existing);
    if (!existingTimes) continue;
    if (rangesOverlap(newTimes.start_time, newTimes.end_time, existingTimes.start_time, existingTimes.end_time)) {
      const label =
        existing.shift_type === "Custom"? `${existing.custom_start_time ? existing.custom_start_time.slice(11, 16) : "?"}–${existing.custom_end_time ? existing.custom_end_time.slice(11, 16) : "?"}`
          : existing.shift_type;
      return {
        ok: false,
        error: `This time overlaps with an existing slot (${label}). Please choose different hours.`,
      };
    }
  }

  return {
    ok: true,
    ...(shiftType === "Custom" && {
      customStartTime: newTimes.start_time,
      customEndTime: newTimes.end_time,
    }),
  };
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
  if (getEffectiveStaffRole(user) !== "virtual_assistant")
    return { success: false, error: "Only virtual assistants can submit VA availability." };

  const vaId = user.airtableUserId ?? user.id;
  const vaName = user.fullName ?? user.email ?? "";
  const weekMonday = getMondayOfWeek(fields.week_start.trim().slice(0, 10));

  if (fields.entry_type === "day_off") {
    const weekRequests = await getRequestsForWeekVa(weekMonday, vaId);
    const dayOffCount = countDayOffForWeekVa(weekRequests);
    if (dayOffCount >= 2) {
      return {
        success: false,
        error: "You can submit at most 2 days off per week. You have already submitted 2.",
      };
    }
  }

  const validation = await validateVaDayAvailabilityRequest({
    weekStart: weekMonday,
    vaId,
    day: fields.day,
    entryType: fields.entry_type,
    shiftType: fields.shift_type,
    customStart: fields.custom_start_time,
    customEnd: fields.custom_end_time,
  });
  if (!validation.ok) return { success: false, error: validation.error };

  try {
    const created = await createWeeklyAvailabilityRequestVa({
      week_start: weekMonday,
      chatter: [vaId],
      chatter_name: vaName,
      day: fields.day,
      entry_type: fields.entry_type,
      ...(fields.entry_type === "availability" && {
        shift_type: fields.shift_type ?? "Morning",
        ...(validation.customStartTime && validation.customEndTime && {
          custom_start_time: validation.customStartTime,
          custom_end_time: validation.customEndTime,
        }),
      }),
      notes: fields.notes ?? "",
    });
    const { title, body } = formSubmittedAdmin("Weekly availability form (VA)", vaName, new Date());
    await notifyAdmins({
      event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title,
      body,
      entity_type: "form",
      entity_id: created.id,
      actor_name: vaName,
    }).catch(() => {});
    await notify({
      user_id: vaId,
      event_type: NOTIFICATION_EVENT.AVAILABILITY_SUBMITTED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: " Availability submitted",
      body: "Your availability for next week has been recorded.",
      entity_type: "system",
      entity_id: created.id,
    }).catch(() => {});
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
  if (getEffectiveStaffRole(user) !== "virtual_assistant")
    return { success: false, error: "Only virtual assistants can update their availability." };

  const vaId = user.airtableUserId ?? user.id;
  const existing = await getWeeklyAvailabilityRequestVaById(recordId);
  if (!existing) return { success: false, error: "Availability entry not found." };
  if (existing.chatter_id !== vaId) {
    return { success: false, error: "You can only edit your own availability." };
  }

  if (existing.status !== "submitted") {
    return { success: false, error: "Only pending submissions can be edited. Contact an admin if this entry should change." };
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
  }

  const validation = await validateVaDayAvailabilityRequest({
    weekStart: existing.week_start,
    vaId,
    day: existing.day,
    entryType: fields.entry_type,
    shiftType: fields.shift_type,
    customStart: fields.custom_start_time,
    customEnd: fields.custom_end_time,
    excludeRecordId: recordId,
  });
  if (!validation.ok) return { success: false, error: validation.error };

  try {
    await updateWeeklyAvailabilityRequestVa(recordId, {
      entry_type: fields.entry_type,
      ...(fields.entry_type === "availability" && {
        shift_type: fields.shift_type ?? "Morning",
        ...(validation.customStartTime && validation.customEndTime && {
          custom_start_time: validation.customStartTime,
          custom_end_time: validation.customEndTime,
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

export type DeleteAvailabilityVaResult = { success: true } | { success: false; error: string };

export async function deleteAvailabilityVaAction(requestId: string): Promise<DeleteAvailabilityVaResult> {
  const user = await getSessionFromCookies();
  if (!user) return { success: false, error: "Not authenticated." };
  if (getEffectiveStaffRole(user) !== "virtual_assistant")
    return { success: false, error: "Only virtual assistants can delete availability." };

  const vaId = user.airtableUserId ?? user.id;
  const existing = await getWeeklyAvailabilityRequestVaById(requestId);
  if (!existing) return { success: false, error: "Availability entry not found." };
  if (existing.chatter_id !== vaId) {
    return { success: false, error: "You can only delete your own availability." };
  }
  if (existing.status !== "submitted") {
    return { success: false, error: "Only pending submissions can be deleted. Contact an admin if this entry should change." };
  }

  try {
    await deleteWeeklyAvailabilityRequestVa(requestId);
    revalidatePath(ROUTES.va.weeklyAvailability);
    revalidatePath(ROUTES.admin.weeklyProgramVa);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
