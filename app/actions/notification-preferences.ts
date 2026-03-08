"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import {
  getPreferencesByUserId,
  createDefaultPreferencesForUser,
  updateNotificationPreference,
} from "@/services/notification-preferences";
import type { NotificationPreference } from "@/types";

export async function getMyNotificationPreferences(): Promise<NotificationPreference | null> {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  const userId = user.airtableUserId ?? user.id;
  let prefs = await getPreferencesByUserId(userId);
  if (!prefs) {
    prefs = await createDefaultPreferencesForUser(userId);
  }
  return prefs;
}

export async function updateMyNotificationPreferences(formData: FormData) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  const userId = user.airtableUserId ?? user.id;
  let prefs = await getPreferencesByUserId(userId);
  if (!prefs) prefs = await createDefaultPreferencesForUser(userId);

  const push_enabled = formData.get("push_enabled") === "on";
  const in_app_enabled = formData.get("in_app_enabled") === "on";
  const critical_only = formData.get("critical_only") === "on";
  const whale_alerts = formData.get("whale_alerts") === "on";
  const shift_alerts = formData.get("shift_alerts") === "on";
  const model_alerts = formData.get("model_alerts") === "on";
  const system_alerts = formData.get("system_alerts") === "on";
  const task_alerts = formData.get("task_alerts") === "on";
  const mute_all = formData.get("mute_all") === "on";
  const quiet_hours_start = (formData.get("quiet_hours_start") as string)?.trim() ?? "";
  const quiet_hours_end = (formData.get("quiet_hours_end") as string)?.trim() ?? "";

  await updateNotificationPreference(prefs.id, {
    push_enabled,
    in_app_enabled,
    critical_only,
    whale_alerts,
    shift_alerts,
    model_alerts,
    system_alerts,
    task_alerts,
    mute_all,
    quiet_hours_start,
    quiet_hours_end,
  });
  revalidatePath(ROUTES.settings);
}
