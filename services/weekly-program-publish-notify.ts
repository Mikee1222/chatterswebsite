"use server";

import { getMondayOfWeek } from "@/lib/weekly-program";
import { listAllUsers } from "@/services/users";
import { notifyByRoleConfig } from "@/services/notification-service";
import { findExistingNotification } from "@/services/notifications";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { schedulePublishedPersonal } from "@/lib/notification-copy";
import { EVENT_TYPE_TO_AIRTABLE } from "@/lib/notifications-schema";

const AIRTABLE_EVENT_SCHEDULE = EVENT_TYPE_TO_AIRTABLE.schedule_published ?? "system_alert";

function normalizeWeekMonday(weekStart: string): string {
  return getMondayOfWeek(weekStart.trim().slice(0, 10));
}

async function notifySchedulePublishedForRole(
  weekStart: string,
  role: "chatter" | "virtual_assistant",
  entityPrefix: string
): Promise<void> {
  const weekMonday = normalizeWeekMonday(weekStart);
  const copy = schedulePublishedPersonal();
  const users = await listAllUsers();
  for (const u of users) {
    if (u.role !== role) continue;
    if ((u.status ?? "").toLowerCase() !== "active") continue;
    if (!u.id) continue;
    const entityId = `${entityPrefix}:${weekMonday}:${u.id}`;
    const dup = await findExistingNotification(u.id, "system", entityId, AIRTABLE_EVENT_SCHEDULE).catch(
      () => true
    );
    if (dup) continue;
    await notifyByRoleConfig(NOTIFICATION_EVENT.SCHEDULE_PUBLISHED, {
      personal_user_id: u.id,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: copy.title,
      body: copy.body,
      entity_type: "system",
      entity_id: entityId,
      context: { weekLabel: weekMonday },
    }).catch(() => {});
  }
}

/** One in-app/push per active chatter per program week when admin saves chatter weekly program. */
export async function notifyActiveChattersWeeklyProgramPublished(weekStart: string): Promise<void> {
  await notifySchedulePublishedForRole(weekStart, "chatter", "weekly_program_ready");
}

/** True when a chatter already received the weekly program publish notification for this week. */
export async function hasChatterWeeklyProgramPublishedNotification(
  weekStart: string,
  chatterUserId: string
): Promise<boolean> {
  const weekMonday = normalizeWeekMonday(weekStart);
  const entityId = `weekly_program_ready:${weekMonday}:${chatterUserId}`;
  return findExistingNotification(chatterUserId, "system", entityId, AIRTABLE_EVENT_SCHEDULE).catch(
    () => false
  );
}

/** One in-app/push per active VA per program week when admin saves VA weekly program. */
export async function notifyActiveVAsWeeklyProgramVaPublished(weekStart: string): Promise<void> {
  await notifySchedulePublishedForRole(weekStart, "virtual_assistant", "weekly_program_va_ready");
}
