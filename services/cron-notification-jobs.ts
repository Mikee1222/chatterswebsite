"use server";

import { addWeeks } from "@/lib/weekly-program";
import { getMondayOfWeekFromYmdAthens, getTodayWeekdayAthens, getWeekStartYmdInAthens } from "@/lib/airtable-datetime";
import { listAllUsers } from "@/services/users";
import { getRequestsForWeek } from "@/services/weekly-availability-requests";
import { getRequestsForWeekVa } from "@/services/weekly-availability-requests-va";
import {
  listAllCustomRequests,
  listStuckCustomRequestsSince,
  markCustomRequestStuckAlertSent,
} from "@/services/custom-requests";
import { getAdminNotificationIds } from "@/services/admin-notification-settings";
import { notify, notifyAdmins } from "@/services/notification-service";
import { findExistingNotification } from "@/services/notifications";
import { NOTIFICATION_EVENT, NOTIFICATION_ENTITY, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { getAllVaTasks, updateVaTask } from "@/services/va-tasks";

/** Stored Airtable event_type for va_task_reminder (see EVENT_TYPE_TO_AIRTABLE). */
const AIRTABLE_EVENT_TASK_SHIFT_STARTED = "task_shift_started";

const AIRTABLE_EVENT_SYSTEM_ALERT = "system_alert";

/** Wall clock in UTC+3 (IANA `Etc/GMT-3`, sign inverted per POSIX). */
function wallClockEtcGmtMinus3(d = new Date()): { weekday: string; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Etc/GMT-3",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const g = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    weekday: g("weekday"),
    hour: parseInt(g("hour"), 10) || 0,
    minute: parseInt(g("minute"), 10) || 0,
  };
}

function parseDeadlineEndMs(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T23:59:59.999Z`).getTime();
  }
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : t;
}

export type SundayAvailabilityReminderResult = {
  ok: true;
  reminders_sent: number;
  skipped_not_sunday: boolean;
};

export type FridayAvailabilityReminderCronResult = {
  ok: true;
  reminders_sent: number;
  skipped_reason: string | null;
  slot: "morning" | "evening" | null;
};

/**
 * Friday only (GMT+3): 09:00 and 21:00 hour windows — remind active chatters/VAs with no
 * weekly availability rows yet for the upcoming Monday week.
 */
export async function runFridayWeeklyAvailabilityReminders(): Promise<FridayAvailabilityReminderCronResult> {
  const { weekday, hour } = wallClockEtcGmtMinus3();
  if (weekday !== "Friday") {
    return { ok: true, reminders_sent: 0, skipped_reason: "not_friday", slot: null };
  }
  const isMorning = hour === 9;
  const isEvening = hour === 21;
  if (!isMorning && !isEvening) {
    return { ok: true, reminders_sent: 0, skipped_reason: "outside_9_or_21_gmt3", slot: null };
  }
  const slot: "morning" | "evening" = isMorning ? "morning" : "evening";
  const title =
    slot === "morning"
      ? "📅 Submit your weekly availability"
      : "⏰ Last chance: Weekly availability";
  const body =
    slot === "morning"
      ? "Don't forget to submit your availability for next week. Deadline is tonight."
      : "Tonight is the deadline. Please submit your availability for next week now.";

  const nextWeekMonday = addWeeks(getWeekStartYmdInAthens(0), 1);
  let reminders_sent = 0;
  const users = await listAllUsers();
  for (const u of users) {
    if ((u.status ?? "").toLowerCase() !== "active") continue;
    if (u.role !== "chatter" && u.role !== "virtual_assistant") continue;
    const uid = u.id;
    if (!uid) continue;
    const requests =
      u.role === "chatter"
        ? await getRequestsForWeek(nextWeekMonday, uid)
        : await getRequestsForWeekVa(nextWeekMonday, uid);
    if (requests.length > 0) continue;
    const entityId = `friday_avail_${slot}:${nextWeekMonday}:${uid}`;
    const dup = await findExistingNotification(uid, "system", entityId, AIRTABLE_EVENT_SYSTEM_ALERT).catch(() => true);
    if (dup) continue;
    await notify({
      user_id: uid,
      event_type: NOTIFICATION_EVENT.WEEKLY_AVAILABILITY_FRIDAY_REMINDER,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title,
      body,
      entity_type: "system",
      entity_id: entityId,
    }).catch(() => {});
    reminders_sent++;
  }
  return { ok: true, reminders_sent, skipped_reason: null, slot };
}

/**
 * On Sunday only: remind active chatters and VAs who have no availability rows for next week (following Monday).
 */
export async function runSundayAvailabilityReminders(): Promise<SundayAvailabilityReminderResult> {
  if (getTodayWeekdayAthens() !== "Sunday") {
    return { ok: true, reminders_sent: 0, skipped_not_sunday: true };
  }
  /** Monday YYYY-MM-DD of the week availability is for (Athens); matches weekly_program `week_start`. NOT calendar "today". */
  const availabilityWeekStartMonday = getMondayOfWeekFromYmdAthens(getWeekStartYmdInAthens(1));
  let reminders_sent = 0;
  const users = await listAllUsers();
  for (const u of users) {
    if ((u.status ?? "").toLowerCase() !== "active") continue;
    if (u.role !== "chatter" && u.role !== "virtual_assistant") continue;
    const uid = u.id;
    if (!uid) continue;
    const requests =
      u.role === "chatter"
        ? await getRequestsForWeek(availabilityWeekStartMonday, uid)
        : await getRequestsForWeekVa(availabilityWeekStartMonday, uid);
    if (requests.length > 0) continue;
    const entityId = `availability_remind:${availabilityWeekStartMonday}:${uid}`;
    const dup = await findExistingNotification(uid, "system", entityId, AIRTABLE_EVENT_SYSTEM_ALERT).catch(() => true);
    if (dup) continue;
    await notify({
      user_id: uid,
      event_type: NOTIFICATION_EVENT.SCHEDULE_UPDATED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "⏰ Reminder: Submit your availability",
      body: "Please submit your availability for next week before midnight.",
      entity_type: "system",
      entity_id: entityId,
    }).catch(() => {});
    reminders_sent++;
  }
  return { ok: true, reminders_sent, skipped_not_sunday: false };
}

export type CustomDeadline48hResult = {
  ok: true;
  requests_scanned: number;
  notifications_sent: number;
};

const AIRTABLE_EVENT_CUSTOM_UPDATED = "custom_request_updated";

/**
 * Notify assigned chatter and each admin once per custom when deadline is in the future and within 48 hours.
 * entity_id uses a synthetic prefix so dedup does not collide with status-update notifications on the same request.
 */
export async function runCustomDeadlinesWithin48Hours(): Promise<CustomDeadline48hResult> {
  const now = Date.now();
  const windowEnd = now + 48 * 60 * 60 * 1000;
  const all = await listAllCustomRequests();
  const admins = await getAdminNotificationIds();
  let notifications_sent = 0;

  for (const req of all) {
    if (!req.deadline_requested?.trim()) continue;
    if (req.admin_status === "rejected") continue;
    if (req.model_status === "completed" || req.model_status === "uploaded" || req.model_status === "declined")
      continue;
    const dl = parseDeadlineEndMs(req.deadline_requested);
    if (dl == null || dl <= now || dl > windowEnd) continue;
    const customTitle = (req.request_title ?? "").trim() || "Custom request";
    const body = `${customTitle} is due in less than 48 hours.`;
    const deadlineAlertEntityId = `deadline_48h:${req.id}`;

    if (req.requested_by_chatter_id) {
      const dupC = await findExistingNotification(
        req.requested_by_chatter_id,
        NOTIFICATION_ENTITY.CUSTOM_REQUEST,
        deadlineAlertEntityId,
        AIRTABLE_EVENT_CUSTOM_UPDATED
      ).catch(() => true);
      if (!dupC) {
        await notify({
          user_id: req.requested_by_chatter_id,
          event_type: NOTIFICATION_EVENT.CUSTOM_DEADLINE_APPROACHING,
          priority: NOTIFICATION_PRIORITY.HIGH,
          title: "⏰ Custom deadline approaching",
          body,
          entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
          entity_id: deadlineAlertEntityId,
        }).catch(() => {});
        notifications_sent++;
      }
    }

    for (const adminId of admins) {
      const dupA = await findExistingNotification(
        adminId,
        NOTIFICATION_ENTITY.CUSTOM_REQUEST,
        deadlineAlertEntityId,
        AIRTABLE_EVENT_CUSTOM_UPDATED
      ).catch(() => true);
      if (dupA) continue;
      await notify({
        user_id: adminId,
        event_type: NOTIFICATION_EVENT.CUSTOM_DEADLINE_APPROACHING,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: "⏰ Custom deadline approaching",
        body,
        entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
        entity_id: deadlineAlertEntityId,
      }).catch(() => {});
      notifications_sent++;
    }
  }

  return { ok: true, requests_scanned: all.length, notifications_sent };
}

export type VaTaskReminderCronResult = {
  ok: true;
  reminders_scanned: number;
  notifications_sent: number;
};

/**
 * VA task due reminders: notify each assignee (or every active VA if unassigned) once per reminder slot.
 * Dedup via notifications entity_id + event_type.
 */
export async function runVaTaskReminders(): Promise<VaTaskReminderCronResult> {
  const { getUpcomingReminders } = await import("@/services/va-tasks");
  const upcoming = await getUpcomingReminders();
  let notifications_sent = 0;

  for (const { task, minutesUntilDue, reminderAtMs, recipientUserIds } of upcoming) {
    const body = `⏰ Task reminder: ${task.title} due in ${minutesUntilDue} min`;
    const slot = new Date(reminderAtMs).toISOString().slice(0, 16);
    const entityId = `va_task_reminder:${task.id}:${slot}`;

    for (const userId of recipientUserIds) {
      if (!userId) continue;
      const dup = await findExistingNotification(
        userId,
        NOTIFICATION_ENTITY.VA_TASK,
        entityId,
        AIRTABLE_EVENT_TASK_SHIFT_STARTED
      ).catch(() => true);
      if (dup) continue;
      await notify({
        user_id: userId,
        event_type: NOTIFICATION_EVENT.VA_TASK_REMINDER,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: "Task reminder",
        body,
        entity_type: NOTIFICATION_ENTITY.VA_TASK,
        entity_id: entityId,
      }).catch(() => {});
      notifications_sent++;
    }
  }

  return { ok: true, reminders_scanned: upcoming.length, notifications_sent };
}

export type VaTaskOverdueEscalationResult = {
  ok: true;
  overdue_scanned: number;
  notifications_sent: number;
};

export async function runVaTaskOverdueEscalation(): Promise<VaTaskOverdueEscalationResult> {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const tasks = await getAllVaTasks();
  const users = await listAllUsers();
  const nameById = new Map(users.map((u) => [u.id, u.full_name?.trim() || u.email || u.id]));
  let notifications_sent = 0;

  for (const task of tasks) {
    if (task.status === "done" || task.status === "skipped") continue;
    if (!task.due_date?.trim()) continue;
    const dueMs = new Date(task.due_date).getTime();
    if (!Number.isFinite(dueMs) || dueMs >= now) continue;
    const daysOverdue = Math.max(1, Math.floor((now - dueMs) / dayMs));
    const lastNotifiedMs = task.overdue_notified_at ? new Date(task.overdue_notified_at).getTime() : NaN;
    if (Number.isFinite(lastNotifiedMs) && now - lastNotifiedMs < dayMs) continue;

    const recipientIds = task.assigned_to_ids.length
      ? task.assigned_to_ids
      : users
          .filter((u) => u.role === "virtual_assistant" && (u.status ?? "").toLowerCase() === "active")
          .map((u) => u.id)
          .filter(Boolean);

    for (const userId of recipientIds) {
      await notify({
        user_id: userId,
        event_type: NOTIFICATION_EVENT.VA_TASK_REMINDER,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: "⚠️ Task overdue",
        body: `Your task "${task.title}" was due ${daysOverdue} day(s) ago. Please complete or update it.`,
        entity_type: NOTIFICATION_ENTITY.VA_TASK,
        entity_id: `va_task_overdue:${task.id}:${new Date(now).toISOString().slice(0, 10)}`,
      }).catch(() => {});
      notifications_sent++;
    }

    if (daysOverdue > 1) {
      const vaName = recipientIds[0] ? (nameById.get(recipientIds[0]) ?? "VA") : "Unassigned VA";
      await notifyAdmins({
        event_type: NOTIFICATION_EVENT.TASK_OVERDUE,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: `⚠️ VA task overdue: ${task.title}`,
        body: `${vaName}'s task "${task.title}" is ${daysOverdue} days overdue.`,
        entity_type: NOTIFICATION_ENTITY.VA_TASK,
        entity_id: `va_task_overdue_admin:${task.id}:${new Date(now).toISOString().slice(0, 10)}`,
      }).catch(() => {});
      notifications_sent++;
    }

    await updateVaTask(task.id, { overdue_notified_at: new Date(now).toISOString() }).catch(() => {});
  }

  return { ok: true, overdue_scanned: tasks.length, notifications_sent };
}

export type StuckCustomRequestAlertResult = {
  ok: true;
  requests_scanned: number;
  alerts_sent: number;
};

export async function runStuckCustomRequestAlerts(): Promise<StuckCustomRequestAlertResult> {
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const stuckRequests = await listStuckCustomRequestsSince(twoDaysAgo.toISOString());
  let alerts_sent = 0;

  for (const request of stuckRequests) {
    if (request.assigned_va_id) {
      await notify({
        user_id: request.assigned_va_id,
        event_type: NOTIFICATION_EVENT.CUSTOM_DEADLINE_APPROACHING,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: "⏰ Custom request needs attention",
        body: `Custom request "${request.request_title}" has been ${request.model_status} for over 2 days with no update.`,
        entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
        entity_id: `custom_stuck_va:${request.id}`,
      }).catch(() => {});
      alerts_sent++;
    }

    await notifyAdmins({
      event_type: NOTIFICATION_EVENT.CUSTOM_OVERDUE,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: `⚠️ Custom request stuck: ${request.request_title}`,
      body: `Request from ${request.chatter_name || "Unknown chatter"} has been in "${request.model_status}" status for 2+ days. Fan: ${request.fan_username || "Unknown fan"}.`,
      entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
      entity_id: `custom_stuck_admin:${request.id}`,
    }).catch(() => {});
    alerts_sent++;

    await markCustomRequestStuckAlertSent(request.id, true).catch(() => {});
  }

  return { ok: true, requests_scanned: stuckRequests.length, alerts_sent };
}
