"use server";

import { getProgramsForWeek } from "@/services/weekly-program";
import { getShiftsForDate, getLiveShifts } from "@/services/shifts";
import { findExistingNotification } from "@/services/notifications";
import { notifyAdminsOnce, notify } from "@/services/notification-service";
import { EVENT_TYPE_TO_AIRTABLE } from "@/lib/notifications-schema";
import { NOTIFICATION_EVENT, NOTIFICATION_ENTITY, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

const LATE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes after scheduled start
/** Notify ~30 min before start; 15‑min cron aligns with 30–45 min window before shift. */
const SHIFT_SOON_MIN_MS = 30 * 60 * 1000;
const SHIFT_SOON_MAX_MS = 45 * 60 * 1000;
const BREAK_LIMIT_EXCEEDED_MS = 45 * 60 * 1000;

import { getTimesForShiftType, buildCustomShiftTimes } from "@/lib/weekly-program";
import {
  getTodayYmdAthens,
  getTodayWeekdayAthens,
  getWeekStartYmdInAthens,
} from "@/lib/airtable-datetime";
import type { WeeklyProgramShiftType } from "@/types";

function getScheduledStartIso(
  program: {
    day: string;
    shift_type: string;
    start_time?: string;
    end_time?: string;
  },
  dateYmd: string
): string | null {
  const shiftType = program.shift_type as WeeklyProgramShiftType;
  if (shiftType === "Morning" || shiftType === "Night") {
    const times = getTimesForShiftType(shiftType, dateYmd);
    return times.start_time;
  }
  if (shiftType === "Custom" && program.start_time && program.end_time) {
    const startStr = String(program.start_time).trim();
    const endStr = String(program.end_time).trim();
    if (/^\d{1,2}:\d{2}$/.test(startStr) && /^\d{1,2}:\d{2}$/.test(endStr)) {
      const start = startStr.length === 4 ? `0${startStr}` : startStr;
      const end = endStr.length === 4 ? `0${endStr}` : endStr;
      const times = buildCustomShiftTimes(dateYmd, start, end);
      return times.start_time;
    }
    if (startStr.length >= 16) return startStr;
  }
  return null;
}

export type CheckLateShiftsResult = {
  ok: true;
  date: string;
  /** Legacy field; no-show path replaced by scheduled late + chatter notify. Always 0. */
  no_show_sent: number;
  late_sent: number;
  /** Admins notified (deduped) for chatter 10+ min late without starting shift. */
  shift_late_not_started_sent: number;
  /** Chatters notified shift starts in ~30–45 min (deduped). */
  shift_starting_soon_sent: number;
  /** Chatters notified they are 10+ min late (deduped). */
  shift_scheduled_late_chatter_sent: number;
  break_too_long_sent: number;
  /** Chatters notified their own break exceeded 45m (deduped). */
  break_exceeded_chatter_sent: number;
};

/**
 * Late/no-show checks, ~30 min shift heads-up, 10+ min late (chatter + admin), break >45m → admin.
 * Used by /api/cron/check-late-shifts and workers/cron-late-shifts.
 */
export async function runCheckLateShifts(): Promise<CheckLateShiftsResult> {
  const todayYmd = getTodayYmdAthens();
  const todayWeekday = getTodayWeekdayAthens();
  const weekStart = getWeekStartYmdInAthens(0);
  const now = Date.now();
  let lateCount = 0;
  let shiftLateNotStartedAdminCount = 0;
  let shiftStartingSoonCount = 0;
  let shiftScheduledLateChatterCount = 0;
  let breakTooLongCount = 0;
  let breakExceededChatterCount = 0;

  const programs = await getProgramsForWeek(weekStart);
  const programsToday = programs.filter((p) => p.day === todayWeekday);
  const shiftsToday = await getShiftsForDate(todayYmd);

  const airtableSystemAlert = EVENT_TYPE_TO_AIRTABLE.system_alert;
  const airtableShiftLate = EVENT_TYPE_TO_AIRTABLE[NOTIFICATION_EVENT.SHIFT_LATE] ?? NOTIFICATION_EVENT.SHIFT_LATE;

  for (const program of programsToday) {
    const scheduledStartIso = getScheduledStartIso(
      {
        day: program.day,
        shift_type: program.shift_type,
        start_time: program.start_time,
        end_time: program.end_time,
      },
      todayYmd
    );
    if (!scheduledStartIso) continue;
    const scheduledMs = new Date(scheduledStartIso).getTime();
    if (Number.isNaN(scheduledMs)) continue;

    const hasStarted = shiftsToday.some((s) => s.chatter_id === program.chatter_id && s.start_time);
    const deltaMs = scheduledMs - now;

    if (!hasStarted && deltaMs >= SHIFT_SOON_MIN_MS && deltaMs <= SHIFT_SOON_MAX_MS && program.chatter_id) {
      const soonEntityId = `shift_starting_soon:${program.id}:${todayYmd}`;
      const dupSoon = await findExistingNotification(
        program.chatter_id,
        NOTIFICATION_ENTITY.SHIFT,
        soonEntityId,
        airtableSystemAlert
      ).catch(() => true);
      if (!dupSoon) {
        await notify({
          user_id: program.chatter_id,
          event_type: NOTIFICATION_EVENT.SHIFT_STARTING_SOON,
          priority: NOTIFICATION_PRIORITY.HIGH,
          title: "⏰ Shift starting soon",
          body: "Your shift starts in 30 minutes. Get ready!",
          entity_type: NOTIFICATION_ENTITY.SHIFT,
          entity_id: soonEntityId,
          actor_user_id: program.chatter_id,
          actor_name: program.chatter_name ?? undefined,
        }).catch(() => {});
        shiftStartingSoonCount++;
      }
    }

    if (!hasStarted && now - scheduledMs >= LATE_THRESHOLD_MS && program.chatter_id) {
      const minsLate = Math.max(10, Math.floor((now - scheduledMs) / 60000));
      const chatterEntityId = `shift_scheduled_late_chatter:${program.id}:${todayYmd}`;
      const adminEntityId = `shift_scheduled_late_admin:${program.id}:${todayYmd}`;
      const chatterName = program.chatter_name ?? "Staff";

      const dupChatter = await findExistingNotification(
        program.chatter_id,
        NOTIFICATION_ENTITY.SHIFT,
        chatterEntityId,
        airtableShiftLate
      ).catch(() => true);
      if (!dupChatter) {
        await notify({
          user_id: program.chatter_id,
          event_type: NOTIFICATION_EVENT.SHIFT_LATE,
          priority: NOTIFICATION_PRIORITY.HIGH,
          title: "🚨 You're late for your shift",
          body: `🚨 Your shift was supposed to start ${minsLate} minutes ago. Please log in now.`,
          entity_type: NOTIFICATION_ENTITY.SHIFT,
          entity_id: chatterEntityId,
          actor_user_id: program.chatter_id,
          actor_name: program.chatter_name ?? undefined,
        }).catch(() => {});
        shiftScheduledLateChatterCount++;
      }

      await notifyAdminsOnce(
        {
          event_type: NOTIFICATION_EVENT.SHIFT_LATE,
          priority: NOTIFICATION_PRIORITY.HIGH,
          title: `🚨 ${chatterName} is late`,
          body: `🚨 ${chatterName} hasn't started their shift yet — ${minsLate} minutes late.`,
          entity_type: NOTIFICATION_ENTITY.SHIFT,
          entity_id: adminEntityId,
          actor_user_id: program.chatter_id,
          actor_name: program.chatter_name ?? undefined,
        },
        (userId) =>
          findExistingNotification(userId, NOTIFICATION_ENTITY.SHIFT, adminEntityId, airtableShiftLate)
      );
      if (!dupChatter) shiftLateNotStartedAdminCount++;
    }
  }

  for (const shift of shiftsToday) {
    if (!shift.start_time) continue;
    const program = programsToday.find((p) => p.chatter_id === shift.chatter_id);
    if (!program) continue;
    const scheduledStartIso = getScheduledStartIso(
      {
        day: program.day,
        shift_type: program.shift_type,
        start_time: program.start_time,
        end_time: program.end_time,
      },
      todayYmd
    );
    if (!scheduledStartIso) continue;
    const scheduledMs = new Date(scheduledStartIso).getTime();
    const actualMs = new Date(shift.start_time).getTime();
    if (actualMs - scheduledMs < LATE_THRESHOLD_MS) continue;

    await notifyAdminsOnce(
      {
        event_type: NOTIFICATION_EVENT.SHIFT_LATE,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: "⏱️ Shift Started Late",
        body: `⏱️ ${shift.chatter_name ?? "Staff"} started ${Math.round((actualMs - scheduledMs) / 60000)} min late.`,
        entity_type: NOTIFICATION_ENTITY.SHIFT,
        entity_id: shift.id,
        actor_user_id: shift.chatter_id,
        actor_name: shift.chatter_name ?? undefined,
      },
      (userId) => findExistingNotification(userId, NOTIFICATION_ENTITY.SHIFT, shift.id, airtableShiftLate)
    );
    lateCount++;
  }

  const liveShifts = await getLiveShifts();
  for (const shift of liveShifts) {
    if (shift.staff_role !== "chatter") continue;
    if (shift.status !== "on_break" || !shift.break_started_at) continue;
    const breakStartMs = new Date(shift.break_started_at).getTime();
    if (Number.isNaN(breakStartMs)) continue;
    if (now - breakStartMs < BREAK_LIMIT_EXCEEDED_MS) continue;
    const breakEntityId = `break_limit_exceeded:${shift.id}:${shift.break_started_at}`;
    const chatterName = shift.chatter_name ?? "Staff";
    await notifyAdminsOnce(
      {
        event_type: NOTIFICATION_EVENT.BREAK_EXCEEDED,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: "⚠️ Break Limit Exceeded",
        body: `⚠️ ${chatterName} has been on break for over 45 minutes.`,
        entity_type: NOTIFICATION_ENTITY.SHIFT,
        entity_id: breakEntityId,
        actor_user_id: shift.chatter_id,
        actor_name: shift.chatter_name ?? undefined,
      },
      (userId) =>
        findExistingNotification(
          userId,
          NOTIFICATION_ENTITY.SHIFT,
          breakEntityId,
          EVENT_TYPE_TO_AIRTABLE[NOTIFICATION_EVENT.BREAK_EXCEEDED]
        )
    );

    const chatterId = shift.chatter_id?.trim();
    if (chatterId) {
      const breakChatterEntityId = `${breakEntityId}:chatter_self`;
      const airtableBreakEv = EVENT_TYPE_TO_AIRTABLE[NOTIFICATION_EVENT.BREAK_EXCEEDED];
      const dupChatterSelf = await findExistingNotification(
        chatterId,
        NOTIFICATION_ENTITY.SHIFT,
        breakChatterEntityId,
        airtableBreakEv
      ).catch(() => true);
      if (!dupChatterSelf) {
        try {
          await notify({
            user_id: chatterId,
            event_type: NOTIFICATION_EVENT.BREAK_EXCEEDED,
            priority: NOTIFICATION_PRIORITY.HIGH,
            title: "⚠️ Break Time Exceeded",
            body: "⚠️ You've been on break for over 45 minutes. Please return to your shift.",
            entity_type: NOTIFICATION_ENTITY.SHIFT,
            entity_id: breakChatterEntityId,
            actor_user_id: chatterId,
            actor_name: shift.chatter_name ?? undefined,
            _triggerSource: "break_exceeded_chatter_self",
          });
          breakExceededChatterCount++;
        } catch (e) {
          console.error("[check-late-shifts] break_exceeded chatter notify failed", e);
        }
      }
    }

    breakTooLongCount++;
  }

  return {
    ok: true,
    date: todayYmd,
    no_show_sent: 0,
    late_sent: lateCount,
    shift_late_not_started_sent: shiftLateNotStartedAdminCount,
    shift_starting_soon_sent: shiftStartingSoonCount,
    shift_scheduled_late_chatter_sent: shiftScheduledLateChatterCount,
    break_too_long_sent: breakTooLongCount,
    break_exceeded_chatter_sent: breakExceededChatterCount,
  };
}
