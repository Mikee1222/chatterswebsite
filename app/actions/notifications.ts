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
} from "@/services/notifications";

const DEBUG = "[notify-ui-debug]";
const AUTH_DEBUG = "[auth-debug]";

export async function getMyUnreadCount(): Promise<number> {
  const user = await getSessionFromCookies();
  const userId = getNotificationUserId(user);
  console.log(AUTH_DEBUG, "getMyUnreadCount", JSON.stringify({
    resolved_session_user_id: user?.id ?? null,
    resolved_airtable_user_id: user?.airtableUserId ?? null,
    resolved_notification_user_id: userId ?? null,
    route: "getMyUnreadCount",
  }));
  console.log(DEBUG, "getMyUnreadCount", JSON.stringify({ resolved_current_user_id: userId ?? null, session_user_id: user?.id ?? null, airtable_user_id: user?.airtableUserId ?? null }));
  if (userId == null) return 0;
  return getUnreadCount(userId);
}

/** since: ISO date string; only notifications created on or after this date (e.g. last 7/30 days). */
export async function getMyNotifications(unreadOnly = false, pageSize = 50, since?: string) {
  const user = await getSessionFromCookies();
  const userId = getNotificationUserId(user);
  console.log(AUTH_DEBUG, "getMyNotifications", JSON.stringify({
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
  await markAsRead(recordId);
}

export async function markAllMyNotificationsRead() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  const userId = getNotificationUserId(user);
  if (userId == null) return 0;
  const count = await markAllAsRead(userId);
  revalidatePath("/", "layout");
  revalidatePath("/notifications");
  return count;
}
