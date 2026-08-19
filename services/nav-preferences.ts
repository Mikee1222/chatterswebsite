"use server";

import { isSupabaseBackend } from "@/lib/data-backend";
import {
  emptyNavPreferences,
  parseNavPreferencesJson,
  resolveNavPreferences,
  serializeNavPreferences,
  type UserNavPreferences,
} from "@/lib/nav-preferences";
import { getUserByAirtableId, getUserByUserId, updateUser } from "@/services/users";

/** Load nav preferences for a user (by Airtable id or internal user_id). */
export async function getNavPreferencesForUser(
  userId: string,
  role: string
): Promise<UserNavPreferences> {
  if (isSupabaseBackend()) {
    return (await import("./nav-preferences-supabase")).getNavPreferencesForUser(userId, role);
  }
  const user = (await getUserByAirtableId(userId)) ?? (await getUserByUserId(userId));
  if (!user?.nav_preferences) {
    return resolveNavPreferences(null, role);
  }
  const parsed = parseNavPreferencesJson(user.nav_preferences);
  return resolveNavPreferences(parsed, role);
}

/** Persist nav preferences for a user. */
export async function setNavPreferencesForUser(
  userId: string,
  prefs: UserNavPreferences
): Promise<UserNavPreferences> {
  const serialized = serializeNavPreferences(prefs);
  if (isSupabaseBackend()) {
    return (await import("./nav-preferences-supabase")).setNavPreferencesForUser(userId, prefs);
  }
  const user = (await getUserByAirtableId(userId)) ?? (await getUserByUserId(userId));
  if (!user) return emptyNavPreferences();
  await updateUser(user.id, { nav_preferences: serialized } as Parameters<typeof updateUser>[1]);
  return prefs;
}

export async function clearNavPreferencesForUser(userId: string): Promise<void> {
  if (isSupabaseBackend()) {
    await (await import("./nav-preferences-supabase")).clearNavPreferencesForUser(userId);
    return;
  }
  const user = (await getUserByAirtableId(userId)) ?? (await getUserByUserId(userId));
  if (!user) return;
  await updateUser(user.id, { nav_preferences: "" } as Parameters<typeof updateUser>[1]);
}
