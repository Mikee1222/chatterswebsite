"use server";

import { getMondayOfWeek } from "@/lib/weekly-program";
import { listAllUsers } from "@/services/users";
import { notify } from "@/services/notification-service";
import { findExistingNotification } from "@/services/notifications";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

const AIRTABLE_EVENT_SYSTEM = "system_alert";

function normalizeWeekMonday(weekStart: string): string {
  return getMondayOfWeek(weekStart.trim().slice(0, 10));
}

/** One in-app/push per active chatter per program week when admin saves chatter weekly program. */
export async function notifyActiveChattersWeeklyProgramPublished(weekStart: string): Promise<void> {
  const weekMonday = normalizeWeekMonday(weekStart);
  const users = await listAllUsers();
  for (const u of users) {
    if (u.role !== "chatter") continue;
    if ((u.status ?? "").toLowerCase() !== "active") continue;
    if (!u.id) continue;
    const entityId = `weekly_program_ready:${weekMonday}:${u.id}`;
    const dup = await findExistingNotification(u.id, "system", entityId, AIRTABLE_EVENT_SYSTEM).catch(() => true);
    if (dup) continue;
    await notify({
      user_id: u.id,
      event_type: NOTIFICATION_EVENT.SCHEDULE_UPDATED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "📅 Weekly program is ready",
      body: "Your schedule for next week has been published. Check your program.",
      entity_type: "system",
      entity_id: entityId,
    }).catch(() => {});
  }
}

/** True when a chatter already received the "weekly program is ready" publish notification for this week. */
export async function hasChatterWeeklyProgramPublishedNotification(
  weekStart: string,
  chatterUserId: string
): Promise<boolean> {
  const weekMonday = normalizeWeekMonday(weekStart);
  const entityId = `weekly_program_ready:${weekMonday}:${chatterUserId}`;
  return findExistingNotification(chatterUserId, "system", entityId, AIRTABLE_EVENT_SYSTEM).catch(() => false);
}

/** One in-app/push per active VA per program week when admin saves VA weekly program. */
export async function notifyActiveVAsWeeklyProgramVaPublished(weekStart: string): Promise<void> {
  const weekMonday = normalizeWeekMonday(weekStart);
  const users = await listAllUsers();
  for (const u of users) {
    if (u.role !== "virtual_assistant") continue;
    if ((u.status ?? "").toLowerCase() !== "active") continue;
    if (!u.id) continue;
    const entityId = `weekly_program_va_ready:${weekMonday}:${u.id}`;
    const dup = await findExistingNotification(u.id, "system", entityId, AIRTABLE_EVENT_SYSTEM).catch(() => true);
    if (dup) continue;
    await notify({
      user_id: u.id,
      event_type: NOTIFICATION_EVENT.SCHEDULE_UPDATED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "📅 VA weekly program is ready",
      body: "Your VA schedule for next week has been published.",
      entity_type: "system",
      entity_id: entityId,
    }).catch(() => {});
  }
}
