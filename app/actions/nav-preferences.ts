"use server";

import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import {
  MAX_PINNED_NAV_ITEMS,
  type UserNavPreferences,
} from "@/lib/nav-preferences";
import {
  getNavPreferencesForUser,
  setNavPreferencesForUser,
  clearNavPreferencesForUser,
} from "@/services/nav-preferences";

function sessionUserId(user: NonNullable<Awaited<ReturnType<typeof getSessionFromCookies>>>): string {
  return user.airtableUserId ?? user.id;
}

export async function getMyNavPreferences(): Promise<UserNavPreferences> {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  return getNavPreferencesForUser(sessionUserId(user), user.role);
}

export type NavPreferencesPatch = Partial<UserNavPreferences>;

export type SaveNavPreferencesResult = { ok: true } | { ok: false; error: string };

export async function saveMyNavPreferences(
  patch: NavPreferencesPatch
): Promise<SaveNavPreferencesResult> {
  try {
    const user = await getSessionFromCookies();
    if (!user) redirect(ROUTES.login);
    const userId = sessionUserId(user);
    const current = await getNavPreferencesForUser(userId, user.role);
    const next: UserNavPreferences = {
      pinned_hrefs: patch.pinned_hrefs ?? current.pinned_hrefs,
      collapsed_sections: patch.collapsed_sections ?? current.collapsed_sections,
      hidden_sections: patch.hidden_sections ?? current.hidden_sections,
    };
    if (next.pinned_hrefs.length > MAX_PINNED_NAV_ITEMS) {
      return { ok: false, error: `Maximum ${MAX_PINNED_NAV_ITEMS} pinned items.` };
    }
    await setNavPreferencesForUser(userId, next);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save navigation preferences." };
  }
}

export async function resetMyNavPreferences(): Promise<SaveNavPreferencesResult> {
  try {
    const user = await getSessionFromCookies();
    if (!user) redirect(ROUTES.login);
    await clearNavPreferencesForUser(sessionUserId(user));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to reset navigation preferences." };
  }
}

export async function showAllNavSections(): Promise<SaveNavPreferencesResult> {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  const userId = sessionUserId(user);
  const current = await getNavPreferencesForUser(userId, user.role);
  return saveMyNavPreferences({ ...current, hidden_sections: [] });
}
