"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getAdminNotificationIds, setAdminNotificationIds } from "@/services/admin-notification-settings";
import { getUserByAirtableId } from "@/services/users";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";

export type AdminNotificationUserRow = { id: string; name: string; email: string };

async function requireSettingsManage() {
  const u = await getSessionFromCookies();
  if (!u || !(await hasPermission(u, PERMISSIONS.SETTINGS_MANAGE))) return null;
  return u;
}

export async function getAdminNotificationUsers(): Promise<
  { success: true; users: AdminNotificationUserRow[] } | { success: false; error: string }
> {
  const session = await requireSettingsManage();
  if (!session) return { success: false, error: "Unauthorized" };

  const ids = await getAdminNotificationIds();
  const users: AdminNotificationUserRow[] = [];
  for (const id of ids) {
    const row = await getUserByAirtableId(id);
    if (row) {
      users.push({
        id: row.id,
        name: row.full_name?.trim() || "—",
        email: row.email?.trim() || "",
      });
    }
  }
  return { success: true, users };
}

export async function addAdminNotificationUser(
  userId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireSettingsManage();
  if (!session) return { success: false, error: "Unauthorized" };

  const trimmed = userId?.trim();
  if (!trimmed) return { success: false, error: "User is required" };

  const existing = await getUserByAirtableId(trimmed);
  if (!existing) return { success: false, error: "User not found" };

  const ids = await getAdminNotificationIds();
  if (ids.includes(trimmed)) return { success: false, error: "Already receives admin notifications" };

  await setAdminNotificationIds([...ids, trimmed]);
  revalidatePath(ROUTES.settings);
  return { success: true };
}

export async function removeAdminNotificationUser(
  userId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireSettingsManage();
  if (!session) return { success: false, error: "Unauthorized" };

  const trimmed = userId?.trim();
  if (!trimmed) return { success: false, error: "User is required" };

  const ids = await getAdminNotificationIds();
  if (ids.length <= 1) {
    return { success: false, error: "At least one admin notification recipient is required" };
  }
  if (!ids.includes(trimmed)) return { success: false, error: "User is not in the list" };

  await setAdminNotificationIds(ids.filter((id) => id !== trimmed));
  revalidatePath(ROUTES.settings);
  return { success: true };
}
