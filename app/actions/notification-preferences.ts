"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";

/** Next.js redirect() throws; re-throw so redirect can complete. */
function isRedirectError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}
import {
  getPreferencesByUserId,
  createDefaultPreferencesForUser,
  updateNotificationPreference,
} from "@/services/notification-preferences";
import {
  getNotificationDefaultsForRole,
} from "@/services/roles";
import {
  notificationDefaultsToPreferenceFields,
  notificationDefaultsEqual,
  preferenceCategoryFieldsFromPrefs,
} from "@/lib/notification-role-defaults";
import type { NotificationPreference } from "@/types";

export async function getMyNotificationPreferences(): Promise<NotificationPreference | null> {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  const userId = user.airtableUserId ?? user.id;
  let prefs = await getPreferencesByUserId(userId);
  if (!prefs) {
    prefs = await createDefaultPreferencesForUser(userId, user.role);
  }
  return prefs;
}

export type UpdateNotificationPreferencesResult = { ok: true } | { ok: false; error: string };

export async function updateMyNotificationPreferences(
  formData: FormData
): Promise<UpdateNotificationPreferencesResult> {
  try {
    const user = await getSessionFromCookies();
    if (!user) redirect(ROUTES.login);
    const userId = user.airtableUserId ?? user.id;
    let prefs = await getPreferencesByUserId(userId);
    if (!prefs) prefs = await createDefaultPreferencesForUser(userId, user.role);

    const push_enabled = formData.get("push_enabled") === "on";
    const in_app_enabled = formData.get("in_app_enabled") === "on";
    const critical_only = formData.get("critical_only") === "on";
    const whale_alerts = formData.get("whale_alerts") === "on";
    const shift_alerts = formData.get("shift_alerts") === "on";
    const model_alerts = formData.get("model_alerts") === "on";
    const system_alerts = formData.get("system_alerts") === "on";
    const task_alerts = formData.get("task_alerts") === "on";
    const mistake_alerts = formData.get("mistake_alerts") === "on";
    const fine_bonus_alerts = formData.get("fine_bonus_alerts") === "on";
    const period_alerts = formData.get("period_alerts") === "on";
    const marketing_alerts = formData.get("marketing_alerts") === "on";
    const phase_alerts = formData.get("phase_alerts") === "on";
    const reward_alerts = formData.get("reward_alerts") === "on";
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
      mistake_alerts,
      fine_bonus_alerts,
      period_alerts,
      marketing_alerts,
      phase_alerts,
      reward_alerts,
      mute_all,
      quiet_hours_start,
      quiet_hours_end,
    });
    revalidatePath(ROUTES.settings);
    revalidatePath(ROUTES.client.settings);
    return { ok: true };
  } catch (e) {
    if (isRedirectError(e)) throw e;
    const msg = e instanceof Error ? e.message : "Something went wrong while saving.";
    return { ok: false, error: msg };
  }
}

export async function resetMyNotificationPreferencesToRoleDefaults(): Promise<UpdateNotificationPreferencesResult> {
  try {
    const user = await getSessionFromCookies();
    if (!user) redirect(ROUTES.login);
    const userId = user.airtableUserId ?? user.id;
    let prefs = await getPreferencesByUserId(userId);
    if (!prefs) prefs = await createDefaultPreferencesForUser(userId, user.role);

    const roleDefaults = await getNotificationDefaultsForRole(user.role);
    const categoryFields = notificationDefaultsToPreferenceFields(roleDefaults);

    await updateNotificationPreference(prefs.id, categoryFields);
    revalidatePath(ROUTES.settings);
    revalidatePath(ROUTES.client.settings);
    return { ok: true };
  } catch (e) {
    if (isRedirectError(e)) throw e;
    const msg = e instanceof Error ? e.message : "Something went wrong while resetting.";
    return { ok: false, error: msg };
  }
}
