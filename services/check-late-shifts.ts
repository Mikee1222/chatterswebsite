"use server";

import { getProgramsForWeek } from "@/services/weekly-program";
import { getShiftsForDate, getLiveShifts, listShiftModels } from "@/services/shifts";
import { findExistingNotification } from "@/services/notifications";
import { notify, notifyAdminsOnce, notifyByRoleConfig } from "@/services/notification-service";
import { EVENT_TYPE_TO_AIRTABLE } from "@/lib/notifications-schema";
import { NOTIFICATION_EVENT, NOTIFICATION_ENTITY, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

const LATE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes after scheduled start
/** Notify ~30 min before start; 15‑min cron aligns with 30–45 min window before shift. */
const SHIFT_SOON_MIN_MS = 30 * 60 * 1000;
const SHIFT_SOON_MAX_MS = 45 * 60 * 1000;
const BREAK_LIMIT_EXCEEDED_MS = 45 * 60 * 1000;
const OVERTIME_GRACE_MS = 10 * 60 * 1000;
const RUNNING_LONG_BUFFER_MS = 30 * 60 * 1000;
const NO_MODELS_GRACE_MS = 10 * 60 * 1000;

import { getTimesForShiftType, buildCustomShiftTimes, weekdayFromDateYmd } from "@/lib/weekly-program";
import { PRESET_WEEKLY_PROGRAM_SHIFT_TYPES } from "@/lib/weekly-program-shift-types";
import {
  getTodayYmdAthens,
  getTodayWeekdayAthens,
  getWeekStartYmdInAthens,
} from "@/lib/airtable-datetime";
import type { WeeklyProgramShiftType, WeeklyProgramDay } from "@/types";

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
  const weekday = (program.day as WeeklyProgramDay | undefined) ?? weekdayFromDateYmd(dateYmd);
  if ((PRESET_WEEKLY_PROGRAM_SHIFT_TYPES as readonly string[]).includes(shiftType)) {
    const times = getTimesForShiftType(shiftType, dateYmd, weekday);
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

function getScheduledEndIso(
  program: {
    day: string;
    shift_type: string;
    start_time?: string;
    end_time?: string;
  },
  dateYmd: string
): string | null {
  const shiftType = program.shift_type as WeeklyProgramShiftType;
  const weekday = (program.day as WeeklyProgramDay | undefined) ?? weekdayFromDateYmd(dateYmd);
  if ((PRESET_WEEKLY_PROGRAM_SHIFT_TYPES as readonly string[]).includes(shiftType)) {
    const times = getTimesForShiftType(shiftType, dateYmd, weekday);
    return times.end_time;
  }
  if (shiftType === "Custom" && program.start_time && program.end_time) {
    const startStr = String(program.start_time).trim();
    const endStr = String(program.end_time).trim();
    if (/^\d{1,2}:\d{2}$/.test(startStr) && /^\d{1,2}:\d{2}$/.test(endStr)) {
      const start = startStr.length === 4 ? `0${startStr}` : startStr;
      const end = endStr.length === 4 ? `0${endStr}` : endStr;
      const times = buildCustomShiftTimes(dateYmd, start, end);
      return times.end_time;
    }
    if (endStr.length >= 16) return endStr;
  }
  return null;
}

function getProgramScheduleMs(
  program: {
    day: string;
    shift_type: string;
    start_time?: string;
    end_time?: string;
  },
  dateYmd: string
): { startMs: number; endMs: number } | null {
  const startIso = getScheduledStartIso(program, dateYmd);
  const endIso = getScheduledEndIso(program, dateYmd);
  if (!startIso || !endIso) return null;
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return null;
  return { startMs, endMs };
}

export type CheckLateShiftsResult = {
  ok: true;
  date: string;
  /** Scheduled shift ended without the assignee starting. */
  no_show_sent: number;
  late_sent: number;
  /** Admins notified (deduped) for chatter 10+ min late without starting shift. */
  shift_late_not_started_sent: number;
  /** Chatters notified shift starts in ~30–45 min (deduped). */
  shift_starting_soon_sent: number;
  /** Chatters notified they are 10+ min late (deduped). */
  shift_scheduled_late_chatter_sent: number;
  /** Live shifts past scheduled end (deduped). */
  shift_overtime_sent: number;
  /** Live shifts running longer than scheduled duration (deduped). */
  shift_running_long_sent: number;
  /** Live chatter shifts with no models attached (deduped). */
  chatter_no_models_sent: number;
  break_too_long_sent: number;
  /** Chatters notified their own break exceeded 45m (deduped). */
  break_exceeded_chatter_sent: number;
};

/**
 * Late/no-show checks, ~30 min shift heads-up, 10+ min late (chatter + admin),
 * chatter break >45m → admin (VA task-shift pauses excluded — no break time policy).
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
  let noShowCount = 0;
  let shiftOvertimeCount = 0;
  let shiftRunningLongCount = 0;
  let chatterNoModelsCount = 0;
  let breakTooLongCount = 0;
  let breakExceededChatterCount = 0;

  const programs = await getProgramsForWeek(weekStart);
  const programsToday = programs.filter((p) => p.day === todayWeekday);
  const shiftsToday = await getShiftsForDate(todayYmd);

  const airtableSystemAlert = EVENT_TYPE_TO_AIRTABLE.system_alert;
  const airtableShiftLate = EVENT_TYPE_TO_AIRTABLE[NOTIFICATION_EVENT.SHIFT_LATE] ?? NOTIFICATION_EVENT.SHIFT_LATE;
  const airtableShiftNoShow =
    EVENT_TYPE_TO_AIRTABLE[NOTIFICATION_EVENT.SHIFT_NO_SHOW] ?? NOTIFICATION_EVENT.SHIFT_NO_SHOW;
  const airtableShiftOvertime =
    EVENT_TYPE_TO_AIRTABLE[NOTIFICATION_EVENT.SHIFT_OVERTIME] ?? NOTIFICATION_EVENT.SHIFT_OVERTIME;
  const airtableChatterNoModels =
    EVENT_TYPE_TO_AIRTABLE[NOTIFICATION_EVENT.CHATTER_NO_MODELS] ?? NOTIFICATION_EVENT.CHATTER_NO_MODELS;

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
        await notifyByRoleConfig(NOTIFICATION_EVENT.SHIFT_LATE, {
          personal_user_id: program.chatter_id,
          priority: NOTIFICATION_PRIORITY.HIGH,
          title: "🚨 You're late for your shift",
          body: `Your shift was supposed to start ${minsLate} minutes ago. Please log in now.`,
          entity_type: NOTIFICATION_ENTITY.SHIFT,
          entity_id: chatterEntityId,
          actor_user_id: program.chatter_id,
          actor_name: program.chatter_name ?? undefined,
          context: { minutes: minsLate, chatterName },
          should_notify_user: (userId) =>
            userId === program.chatter_id
              ? Promise.resolve(true)
              : findExistingNotification(userId, NOTIFICATION_ENTITY.SHIFT, adminEntityId, airtableShiftLate).then(
                  (exists) => !exists
                ),
        }).catch(() => {});
        shiftScheduledLateChatterCount++;
      }
    }

    if (!hasStarted && program.chatter_id) {
      const schedule = getProgramScheduleMs(
        {
          day: program.day,
          shift_type: program.shift_type,
          start_time: program.start_time,
          end_time: program.end_time,
        },
        todayYmd
      );
      if (schedule && now > schedule.endMs) {
        const entityId = `shift_no_show:${program.id}:${todayYmd}`;
        const chatterName = program.chatter_name ?? "Staff";
        const dupNoShow = await findExistingNotification(
          program.chatter_id,
          NOTIFICATION_ENTITY.SHIFT,
          entityId,
          airtableShiftNoShow
        ).catch(() => true);
        if (!dupNoShow) {
          await notifyByRoleConfig(NOTIFICATION_EVENT.SHIFT_NO_SHOW, {
            personal_user_id: program.chatter_id,
            priority: NOTIFICATION_PRIORITY.HIGH,
            title: "🚨 No-show for scheduled shift",
            body: "You did not start your scheduled shift today. Please contact your manager.",
            entity_type: NOTIFICATION_ENTITY.SHIFT,
            entity_id: entityId,
            actor_user_id: program.chatter_id,
            actor_name: program.chatter_name ?? undefined,
            context: { chatterName },
            should_notify_user: (userId) =>
              findExistingNotification(userId, NOTIFICATION_ENTITY.SHIFT, entityId, airtableShiftNoShow).then(
                (exists) => !exists
              ),
          }).catch(() => {});
          noShowCount++;
        }
      }
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

    await notifyByRoleConfig(NOTIFICATION_EVENT.SHIFT_LATE, {
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "⏱️ Shift started late",
      body: `${shift.chatter_name ?? "Staff"} started ${Math.round((actualMs - scheduledMs) / 60000)} min late.`,
      entity_type: NOTIFICATION_ENTITY.SHIFT,
      entity_id: shift.id,
      actor_user_id: shift.chatter_id,
      actor_name: shift.chatter_name ?? undefined,
      personal_user_id: shift.chatter_id,
      context: { minutes: Math.round((actualMs - scheduledMs) / 60000) },
      should_notify_user: (userId) =>
        findExistingNotification(userId, NOTIFICATION_ENTITY.SHIFT, shift.id, airtableShiftLate).then(
          (exists) => !exists
        ),
    }).catch(() => {});
    lateCount++;
  }

  const liveShifts = await getLiveShifts();
  for (const shift of liveShifts) {
    const chatterId = shift.chatter_id?.trim();
    if (!chatterId) continue;
    const chatterName = shift.chatter_name ?? "Staff";
    const program = programsToday.find((p) => p.chatter_id === chatterId);
    const schedule = program
      ? getProgramScheduleMs(
          {
            day: program.day,
            shift_type: program.shift_type,
            start_time: program.start_time,
            end_time: program.end_time,
          },
          todayYmd
        )
      : null;
    const shiftStartMs = shift.start_time ? new Date(shift.start_time).getTime() : NaN;

    if (
      schedule &&
      (shift.staff_role === "chatter" || shift.staff_role === "virtual_assistant") &&
      now > schedule.endMs + OVERTIME_GRACE_MS
    ) {
      const entityId = `shift_overtime:${shift.id}:${todayYmd}`;
      const dupOvertime = await findExistingNotification(
        chatterId,
        NOTIFICATION_ENTITY.SHIFT,
        entityId,
        airtableShiftOvertime
      ).catch(() => true);
      if (!dupOvertime) {
        await notifyByRoleConfig(NOTIFICATION_EVENT.SHIFT_OVERTIME, {
          personal_user_id: chatterId,
          priority: NOTIFICATION_PRIORITY.HIGH,
          title: "⏰ Shift overtime",
          body: "Your scheduled shift has ended. Please wrap up or end your shift.",
          entity_type: NOTIFICATION_ENTITY.SHIFT,
          entity_id: entityId,
          actor_user_id: chatterId,
          actor_name: shift.chatter_name ?? undefined,
          context: { chatterName },
          should_notify_user: (userId) =>
            findExistingNotification(userId, NOTIFICATION_ENTITY.SHIFT, entityId, airtableShiftOvertime).then(
              (exists) => !exists
            ),
        }).catch(() => {});
        shiftOvertimeCount++;
      }
    }

    if (
      schedule &&
      (shift.staff_role === "chatter" || shift.staff_role === "virtual_assistant") &&
      Number.isFinite(shiftStartMs)
    ) {
      const scheduledDurationMs = schedule.endMs - schedule.startMs;
      if (now - shiftStartMs > scheduledDurationMs + RUNNING_LONG_BUFFER_MS) {
        const entityId = `shift_running_long:${shift.id}:${todayYmd}`;
        const dupRunningLong = await findExistingNotification(
          chatterId,
          NOTIFICATION_ENTITY.SHIFT,
          entityId,
          airtableShiftOvertime
        ).catch(() => true);
        if (!dupRunningLong) {
          const minsOver = Math.max(1, Math.floor((now - shiftStartMs - scheduledDurationMs) / 60000));
          await notifyByRoleConfig(NOTIFICATION_EVENT.SHIFT_RUNNING_LONG, {
            personal_user_id: chatterId,
            priority: NOTIFICATION_PRIORITY.HIGH,
            title: "⏱️ Shift running long",
            body: `Your shift is running ${minsOver} minutes longer than scheduled. Consider ending soon.`,
            entity_type: NOTIFICATION_ENTITY.SHIFT,
            entity_id: entityId,
            actor_user_id: chatterId,
            actor_name: shift.chatter_name ?? undefined,
            context: { chatterName, minutes: minsOver },
            should_notify_user: (userId) =>
              findExistingNotification(userId, NOTIFICATION_ENTITY.SHIFT, entityId, airtableShiftOvertime).then(
                (exists) => !exists
              ),
          }).catch(() => {});
          shiftRunningLongCount++;
        }
      }
    }

    if (
      shift.staff_role === "chatter" &&
      Number.isFinite(shiftStartMs) &&
      now - shiftStartMs >= NO_MODELS_GRACE_MS
    ) {
      const models = await listShiftModels(shift.id).catch(() => []);
      const activeModels = models.filter((sm) => !sm.left_at);
      if (activeModels.length === 0) {
        const entityId = `chatter_no_models:${shift.id}:${todayYmd}`;
        const dupNoModels = await findExistingNotification(
          chatterId,
          NOTIFICATION_ENTITY.SHIFT,
          entityId,
          airtableChatterNoModels
        ).catch(() => true);
        if (!dupNoModels) {
          await notifyByRoleConfig(NOTIFICATION_EVENT.CHATTER_NO_MODELS, {
            personal_user_id: chatterId,
            priority: NOTIFICATION_PRIORITY.HIGH,
            title: "⚠️ No models on shift",
            body: "You're on shift with no models attached. Add models from the shift page.",
            entity_type: NOTIFICATION_ENTITY.SHIFT,
            entity_id: entityId,
            actor_user_id: chatterId,
            actor_name: shift.chatter_name ?? undefined,
            context: { chatterName },
            should_notify_user: (userId) =>
              findExistingNotification(userId, NOTIFICATION_ENTITY.SHIFT, entityId, airtableChatterNoModels).then(
                (exists) => !exists
              ),
          }).catch(() => {});
          chatterNoModelsCount++;
        }
      }
    }

    // 45-min break policy is chatter-only. VA task-shift pauses reuse on_break — never flag them.
    if (shift.staff_role !== "chatter") continue;
    if (shift.shift_type === "task" || shift.shift_type === "va_tasks") continue;
    if (shift.status !== "on_break" || !shift.break_started_at) continue;
    const breakStartMs = new Date(shift.break_started_at).getTime();
    if (Number.isNaN(breakStartMs)) continue;
    if (now - breakStartMs < BREAK_LIMIT_EXCEEDED_MS) continue;
    const breakEntityId = `break_limit_exceeded:${shift.id}:${shift.break_started_at}`;
    await notifyAdminsOnce(
      {
        event_type: NOTIFICATION_EVENT.BREAK_EXCEEDED,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: "⚠️ Break limit exceeded",
        body: `${chatterName} has been on break for over 45 minutes.`,
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
            title: "⚠️ Break time exceeded",
            body: "You've been on break for over 45 minutes. Please return to your shift.",
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
    no_show_sent: noShowCount,
    late_sent: lateCount,
    shift_late_not_started_sent: shiftLateNotStartedAdminCount,
    shift_starting_soon_sent: shiftStartingSoonCount,
    shift_scheduled_late_chatter_sent: shiftScheduledLateChatterCount,
    shift_overtime_sent: shiftOvertimeCount,
    shift_running_long_sent: shiftRunningLongCount,
    chatter_no_models_sent: chatterNoModelsCount,
    break_too_long_sent: breakTooLongCount,
    break_exceeded_chatter_sent: breakExceededChatterCount,
  };
}
