"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { getNotificationUserId } from "@/lib/notification-user";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import {
  listNotificationsForUser,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotificationForUser,
} from "@/services/notifications";
import { broadcastUserUnreadCount } from "@/lib/realtime-broadcast";
import { devLog } from "@/lib/dev-log";

const DEBUG = "[notify-ui-debug]";
const AUTH_DEBUG = "[auth-debug]";

export async function getMyUnreadCount(): Promise<number> {
  const user = await getSessionFromCookies();
  const userId = getNotificationUserId(user);
  devLog(AUTH_DEBUG, "getMyUnreadCount", JSON.stringify({
    resolved_session_user_id: user?.id ?? null,
    resolved_airtable_user_id: user?.airtableUserId ?? null,
    resolved_notification_user_id: userId ?? null,
    route: "getMyUnreadCount",
  }));
  devLog(DEBUG, "getMyUnreadCount", JSON.stringify({ resolved_current_user_id: userId ?? null, session_user_id: user?.id ?? null, airtable_user_id: user?.airtableUserId ?? null }));
  if (userId == null) return 0;
  return getUnreadCount(userId);
}

/** since: ISO date string; only notifications created on or after this date (e.g. last 7/30 days). */
export async function getMyNotifications(unreadOnly = false, pageSize = 50, since?: string) {
  const user = await getSessionFromCookies();
  const userId = getNotificationUserId(user);
  devLog(AUTH_DEBUG, "getMyNotifications", JSON.stringify({
    resolved_session_user_id: user?.id ?? null,
    resolved_airtable_user_id: user?.airtableUserId ?? null,
    resolved_notification_user_id: userId ?? null,
    route: "getMyNotifications",
  }));
  if (userId == null) return { notifications: [] };
  const { notifications } = await listNotificationsForUser(userId, {
    pageSize,
    unreadOnly,
    since,
  });
  return { notifications };
}

export async function markNotificationRead(recordId: string) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  const userId = getNotificationUserId(user);
  if (userId == null) return;
  await markAsRead(recordId, userId);
  const unreadCount = await getUnreadCount(userId);
  await broadcastUserUnreadCount(userId, unreadCount).catch(() => {});
  revalidatePath("/", "layout");
  revalidatePath("/notifications");
  return unreadCount;
}

/** Deletes one or more notifications owned by the current user. */
export async function deleteMyNotifications(recordIds: string[]) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  const userId = getNotificationUserId(user);
  if (userId == null) return;
  const unique = [...new Set(recordIds.filter(Boolean))];
  for (const id of unique) {
    await deleteNotificationForUser(id, userId);
  }
  revalidatePath("/", "layout");
  revalidatePath("/notifications");
}

export async function markAllMyNotificationsRead() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  const userId = getNotificationUserId(user) ?? user.airtableUserId ?? user.id;
  if (!userId) return { marked: 0, unreadCount: 0 };
  const marked = await markAllAsRead(userId);
  const unreadCount = await getUnreadCount(userId);
  await broadcastUserUnreadCount(userId, unreadCount).catch(() => {});
  revalidatePath("/", "layout");
  revalidatePath("/notifications");
  return { marked, unreadCount };
}
