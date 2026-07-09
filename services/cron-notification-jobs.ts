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
import { listModelPersonalEventsInDateRange, personalEventEmoji, personalEventLabel } from "@/services/model-personal-events";
import { listAllModelss } from "@/services/modelss";
import { listAllVAContentAssignments } from "@/services/va-content-assignments";
import { listAllWhales } from "@/services/whales";
import { EVENT_TYPE_TO_AIRTABLE } from "@/lib/notifications-schema";
import { listAllRecords, updateRecord } from "@/lib/airtable-server";

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
    slot === "morning"? "📅 Submit your weekly availability": "⏰ Last chance: Weekly availability";
  const body =
    slot === "morning"? "📅 Don't forget to submit your availability for next week. Deadline is tonight.": "⏰ Tonight is the deadline. Please submit your availability for next week now.";

  const nextWeekMonday = addWeeks(getWeekStartYmdInAthens(0), 1);
  let reminders_sent = 0;
  const users = await listAllUsers();
  for (const u of users) {
    if ((u.status ?? "").toLowerCase() !== "active") continue;
    if (u.role !== "chatter" && u.role !== "virtual_assistant") continue;
    const uid = u.id;
    if (!uid) continue;
    const requests =
      u.role === "chatter"? await getRequestsForWeek(nextWeekMonday, uid)
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
      u.role === "chatter"? await getRequestsForWeek(availabilityWeekStartMonday, uid)
        : await getRequestsForWeekVa(availabilityWeekStartMonday, uid);
    if (requests.length > 0) continue;
    const entityId = `availability_remind:${availabilityWeekStartMonday}:${uid}`;
    const dup = await findExistingNotification(uid, "system", entityId, AIRTABLE_EVENT_SYSTEM_ALERT).catch(() => true);
    if (dup) continue;
    await notify({
      user_id: uid,
      event_type: NOTIFICATION_EVENT.SCHEDULE_UPDATED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "⏰ Reminder: submit your availability",
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
    const body = `⏰ ${customTitle} is due in less than 48 hours.`;
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
        title: "📋 Task Reminder",
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
        event_type: NOTIFICATION_EVENT.TASK_OVERDUE,
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

export type VaRecurringSpawnCronResult = {
  ok: true;
  scanned: number;
  spawned: number;
};

export type VaTodayRecurringSpawnCronResult = {
  ok: true;
  spawned: number;
  skipped: number;
};

/**
 * Backfill: recurring tasks marked done whose next occurrence row is missing (e.g. spawn failed on completion).
 * De-dupes by series key + Athens calendar day of the target due date.
 */
export async function runVaRecurringTaskSpawner(): Promise<VaRecurringSpawnCronResult> {
  try {
    const { getAllVaTasks } = await import("@/services/va-tasks");
    const { getNextOccurrence, shouldSpawnRecurring } = await import("@/lib/recurrence");
    const { spawnNextRecurringOccurrenceAfterComplete } = await import("@/services/va-task-recurring-spawn");

    let allTasks = await getAllVaTasks();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const doneRecurring = allTasks.filter((t) => {
      if (!t.is_recurring || t.status !== "done" || !t.due_date?.trim()) return false;
      const due = new Date(t.due_date.trim());
      if (!Number.isFinite(due.getTime())) return false;
      return due.getTime() < today.getTime();
    });

    let spawned = 0;
    for (const task of doneRecurring) {
      if (!shouldSpawnRecurring(task)) continue;
      if (!task.due_date || !task.recurrence_type) continue;
      const nextDue = getNextOccurrence(
        task.due_date,
        task.recurrence_type,
        task.recurrence_interval ?? 1,
        task.recurrence_days ?? [],
        task.recurrence_end_date
      );
      if (!nextDue) continue;

      const result = await spawnNextRecurringOccurrenceAfterComplete(task, allTasks);
      if (result) {
        spawned += 1;
        console.log(`[cron] spawned recurring task "${task.title}" → ${nextDue}`);
        allTasks = await getAllVaTasks();
      }
    }

    return { ok: true, scanned: doneRecurring.length, spawned };
  } catch (e) {
    console.error("[runVaRecurringTaskSpawner]", e);
    return { ok: true, scanned: 0, spawned: 0 };
  }
}

/**
 * Day-boundary safety net: spawn today's real occurrence for every active recurring series,
 * regardless of whether prior days were completed.
 */
export async function runVaTodayRecurringOccurrenceSpawner(): Promise<VaTodayRecurringSpawnCronResult> {
  try {
    const { spawnTodayRecurringOccurrencesAll } = await import("@/services/va-task-recurring-spawn");
    const result = await spawnTodayRecurringOccurrencesAll();
    if (result.spawned > 0) {
      console.log(`[cron] spawned ${result.spawned} today's recurring occurrence(s)`);
    }
    return { ok: true, ...result };
  } catch (e) {
    console.error("[runVaTodayRecurringOccurrenceSpawner]", e);
    return { ok: true, spawned: 0, skipped: 0 };
  }
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

export type PersonalEventReminderResult = {
  ok: true;
  events_scanned: number;
  reminders_sent: number;
};

export async function runPersonalEventReminders(): Promise<PersonalEventReminderResult> {
  const target = new Date();
  target.setDate(target.getDate() + 2);
  const ymd = target.toISOString().slice(0, 10);
  const [events, models, assignments] = await Promise.all([
    listModelPersonalEventsInDateRange(ymd, ymd),
    listAllModelss().catch(() => []),
    listAllVAContentAssignments().catch(() => []),
  ]);
  const modelNameById = new Map(models.map((m) => [m.id, m.model_name || m.model_id || m.id]));
  let reminders_sent = 0;

  for (const ev of events) {
    if (ev.reminder_sent) continue;
    const vaIds = [
      ...new Set(assignments.filter((a) => a.model_id === ev.model_id).map((a) => a.va_id?.trim()).filter((v): v is string => Boolean(v))),
    ];
    if (vaIds.length === 0) continue;
    const modelName = modelNameById.get(ev.model_id) ?? "Model";
    const label = personalEventLabel(ev);
    const emoji = personalEventEmoji(ev.event_type);
    await Promise.all(
      vaIds.map((vaId) =>
        notify({
          user_id: vaId,
          event_type: NOTIFICATION_EVENT.SCHEDULE_UPDATED,
          priority: NOTIFICATION_PRIORITY.NORMAL,
          title: `⏰ Reminder: ${modelName} has ${label} in 2 days`,
          body: `${emoji} ${label} on ${ev.event_date}. Plan content scheduling around this.`,
          entity_type: "system",
          entity_id: ev.id,
        }).catch(() => {})
      )
    );
    reminders_sent += vaIds.length;
    await updateRecord("model_personal_events", ev.id, { reminder_sent: true }).catch(() => {});
  }

  return { ok: true, events_scanned: events.length, reminders_sent };
}

export type WhaleFollowupReminderResult = {
  ok: true;
  whales_scanned: number;
  reminders_sent: number;
};

/** Stored Airtable event_type for whale_followup (see EVENT_TYPE_TO_AIRTABLE). */
const AIRTABLE_EVENT_WHALE_FOLLOWUP = EVENT_TYPE_TO_AIRTABLE["whale_followup"] ?? "whale_assigned";

/**
 * Notify the assigned chatter when a whale's `next_followup` date is due today (or overdue).
 * De-duped per whale per calendar day (Athens), so an overdue whale nudges once daily until the
 * chatter updates `next_followup`.
 */
export async function runWhaleFollowupReminders(): Promise<WhaleFollowupReminderResult> {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(new Date());
  const whales = await listAllWhales();
  let reminders_sent = 0;

  for (const whale of whales) {
    const followupDate = (whale.next_followup ?? "").slice(0, 10);
    if (!followupDate || followupDate > today) continue;
    if ((whale.status ?? "").toLowerCase() !== "active") continue;
    const chatterId = whale.assigned_chatter_id?.trim();
    if (!chatterId) continue;

    const entityId = `whale_followup:${whale.id}:${today}`;
    const dup = await findExistingNotification(
      chatterId,
      NOTIFICATION_ENTITY.WHALE,
      entityId,
      AIRTABLE_EVENT_WHALE_FOLLOWUP
    ).catch(() => true);
    if (dup) continue;

    const overdue = followupDate < today;
    await notify({
      user_id: chatterId,
      event_type: "whale_followup",
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: overdue ? "🐋 Whale follow-up overdue" : "🐋 Whale follow-up due today",
      body: overdue
        ? `Follow-up with ${whale.username || "your whale"} was due on ${followupDate}.`
        : `Time to follow up with ${whale.username || "your whale"} today.`,
      entity_type: NOTIFICATION_ENTITY.WHALE,
      entity_id: entityId,
    }).catch(() => {});
    reminders_sent++;
  }

  return { ok: true, whales_scanned: whales.length, reminders_sent };
}

export type PhaseOverdueCronResult = {
  ok: true;
  phases_marked: number;
  notifications_sent: number;
};

/** Mark pending phases past `scheduled_time` as overdue and notify admins + assigned VA. */
export async function runPhaseOverdueCheck(): Promise<PhaseOverdueCronResult> {
  const esc = (s: string) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  let phases_marked = 0;
  let notifications_sent = 0;
  try {
    const phases = await listAllRecords("va_task_phases", {
      filterByFormula: `AND({status} = "pending", {scheduled_time} != "")`,
    });

    for (const phase of phases) {
      const scheduled = String((phase.fields as { scheduled_time?: string }).scheduled_time ?? "").trim();
      if (!scheduled) continue;
      const tMs = new Date(scheduled).getTime();
      if (!Number.isFinite(tMs) || tMs > Date.now()) continue;

      const phaseKey = String((phase.fields as { phase_id?: string }).phase_id ?? phase.id);
      const items = await listAllRecords("va_task_phase_items", {
        filterByFormula: `{phase_id} = "${esc(phaseKey)}"`,
      });
      const allDone = items.length > 0 && items.every((i) => (i.fields as { status?: string }).status === "completed");
      if (allDone) continue;

      await updateRecord("va_task_phases", phase.id, { status: "overdue" });
      phases_marked += 1;

      const phaseTitle = String((phase.fields as { title?: string }).title ?? "Phase");
      const vaId = String((phase.fields as { assigned_va_id?: string }).assigned_va_id ?? "").trim();

      await notifyAdmins({
        event_type: NOTIFICATION_EVENT.PHASE_OVERDUE,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: "⚠️ Phase overdue",
        body: `"${phaseTitle}" deadline passed with incomplete items.`,
        entity_type: NOTIFICATION_ENTITY.VA_TASK_PHASE,
        entity_id: phase.id,
      }).catch(() => {});
      notifications_sent += 1;

      if (vaId) {
        await notify({
          user_id: vaId,
          event_type: NOTIFICATION_EVENT.PHASE_OVERDUE,
          priority: NOTIFICATION_PRIORITY.HIGH,
          title: `⚠️ Phase overdue: ${phaseTitle}`,
          body: `The deadline for "${phaseTitle}" has passed. Please complete remaining items.`,
          entity_type: NOTIFICATION_ENTITY.VA_TASK_PHASE,
          entity_id: phase.id,
        }).catch(() => {});
        notifications_sent += 1;
      }
    }

    return { ok: true, phases_marked, notifications_sent };
  } catch (e) {
    console.error("[runPhaseOverdueCheck]", e);
    return { ok: true, phases_marked, notifications_sent };
  }
}

