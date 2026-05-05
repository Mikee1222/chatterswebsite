"use server";

import { getSessionFromCookies } from "@/lib/auth";
import { getSystemSetting, setSystemSetting } from "@/services/system-settings";
import {
  EMPTY_HIDDEN_NAV_BY_PROFILE,
  parseHiddenNavSettingJson,
  type NavStorageProfile,
} from "@/lib/nav-config";

const NAV_VISIBILITY_KEY = "hidden_nav_items";
const NAV_VISIBILITY_DESCRIPTION =
  "JSON object: hidden nav hrefs per profile (chatter, virtual_assistant, admin, model).";

export type HiddenNavByProfile = Record<NavStorageProfile, string[]>;

export type NavVisibilityActionResult =
  | { success: true }
  | { success: false; error: string };

/** Load hidden nav config from Airtable (admin UI). */
export async function getNavVisibilityAction(): Promise<HiddenNavByProfile> {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "admin") {
    return { ...EMPTY_HIDDEN_NAV_BY_PROFILE };
  }
  const raw = await getSystemSetting(NAV_VISIBILITY_KEY).catch(() => null);
  return parseHiddenNavSettingJson(raw);
}

/**
 * Persist hidden nav links per role profile (same JSON shape as former localStorage).
 * Admin only.
 */
export async function setNavVisibilityAction(hiddenByProfile: HiddenNavByProfile): Promise<NavVisibilityActionResult> {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "admin") {
    return { success: false, error: "Only admins can update navigation visibility." };
  }
  try {
    const normalized: HiddenNavByProfile = { ...EMPTY_HIDDEN_NAV_BY_PROFILE };
    for (const k of Object.keys(normalized) as NavStorageProfile[]) {
      const arr = hiddenByProfile[k];
      normalized[k] = Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
    }
    await setSystemSetting(NAV_VISIBILITY_KEY, JSON.stringify(normalized), NAV_VISIBILITY_DESCRIPTION);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}
