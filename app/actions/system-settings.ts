"use server";

import { getSessionFromCookies } from "@/lib/auth";
import { getSystemSetting, setSystemSetting } from "@/services/system-settings";
import {
  EMPTY_HIDDEN_NAV_BY_PROFILE,
  EMPTY_VA_HIDDEN_BY_TYPE,
  parseHiddenNavSettingJson,
  serializeHiddenNavConfig,
  type NavStorageProfile,
  type ParsedHiddenNavConfig,
  type VaHiddenNavByType,
} from "@/lib/nav-config";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";

const NAV_VISIBILITY_KEY = "hidden_nav_items";
const NAV_VISIBILITY_DESCRIPTION =
  "JSON object: hidden nav hrefs per profile (chatter, virtual_assistant, admin, model). VA may use per-type lists.";

export type NavVisibilityState = ParsedHiddenNavConfig;

export type NavVisibilityActionResult =
  | { success: true }
  | { success: false; error: string };

function emptyNavVisibilityState(): NavVisibilityState {
  return {
    byProfile: { ...EMPTY_HIDDEN_NAV_BY_PROFILE },
    vaByType: { ...EMPTY_VA_HIDDEN_BY_TYPE },
  };
}

function normalizeVaByType(raw: VaHiddenNavByType | null | undefined): VaHiddenNavByType {
  return {
    chatting: Array.isArray(raw?.chatting) ? raw!.chatting.filter((x): x is string => typeof x === "string") : [],
    marketing: Array.isArray(raw?.marketing) ? raw!.marketing.filter((x): x is string => typeof x === "string") : [],
    both: Array.isArray(raw?.both) ? raw!.both.filter((x): x is string => typeof x === "string") : [],
  };
}

/** Load hidden nav config from Airtable (admin UI). */
export async function getNavVisibilityAction(): Promise<NavVisibilityState> {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.SETTINGS_MANAGE))) {
    return emptyNavVisibilityState();
  }
  const raw = await getSystemSetting(NAV_VISIBILITY_KEY).catch(() => null);
  const parsed = parseHiddenNavSettingJson(raw);
  return {
    byProfile: { ...parsed.byProfile },
    vaByType: parsed.vaByType ? normalizeVaByType(parsed.vaByType) : { ...EMPTY_VA_HIDDEN_BY_TYPE },
  };
}

/**
 * Persist hidden nav links per role profile.
 * Admin only. Always stores extended VA shape `{ chatting, marketing, both }`.
 */
export async function setNavVisibilityAction(state: NavVisibilityState): Promise<NavVisibilityActionResult> {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.SETTINGS_MANAGE))) {
    return { success: false, error: "Only admins can update navigation visibility." };
  }
  try {
    const byProfile = { ...EMPTY_HIDDEN_NAV_BY_PROFILE };
    for (const k of Object.keys(byProfile) as NavStorageProfile[]) {
      if (k === "virtual_assistant") continue;
      const arr = state.byProfile?.[k];
      byProfile[k] = Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
    }
    const config: ParsedHiddenNavConfig = {
      byProfile,
      vaByType: normalizeVaByType(state.vaByType),
    };
    await setSystemSetting(NAV_VISIBILITY_KEY, serializeHiddenNavConfig(config), NAV_VISIBILITY_DESCRIPTION);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}
