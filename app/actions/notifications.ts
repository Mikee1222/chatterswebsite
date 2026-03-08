"use server";

import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import {
  listNotificationsForUser,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "@/services/notifications";

export async function getMyUnreadCount(): Promise<number> {
  const user = await getSessionFromCookies();
  if (!user) return 0;
  const userId = user.airtableUserId ?? user.id;
  return getUnreadCount(userId);
}

export async function getMyNotifications(unreadOnly = false, pageSize = 50) {
  const user = await getSessionFromCookies();
  if (!user) return { notifications: [] };
  const userId = user.airtableUserId ?? user.id;
  const { notifications } = await listNotificationsForUser(userId, {
    pageSize,
    unreadOnly,
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
  const userId = user.airtableUserId ?? user.id;
  await markAllAsRead(userId);
}
