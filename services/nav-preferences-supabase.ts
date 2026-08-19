/**
 * Supabase backend for services/nav-preferences.ts
 */
import {
  parseNavPreferencesJson,
  resolveNavPreferences,
  serializeNavPreferences,
  type UserNavPreferences,
} from "@/lib/nav-preferences";
import { publicId, sbSelectByPublicId, sbSelectEq, sbUpdateByPublicId, type SbRow } from "@/lib/supabase-data";

const TABLE = "users";

type Row = SbRow & {
  nav_preferences?: unknown;
  user_id?: string | null;
};

function parseRowPrefs(raw: unknown): UserNavPreferences | null {
  if (raw == null) return null;
  if (typeof raw === "string") return parseNavPreferencesJson(raw);
  if (typeof raw === "object") {
    try {
      return parseNavPreferencesJson(JSON.stringify(raw));
    } catch {
      return null;
    }
  }
  return null;
}

async function findUserRow(userId: string): Promise<Row | null> {
  const byPublic = await sbSelectByPublicId<Row>(TABLE, userId);
  if (byPublic) return byPublic;
  const byUserId = await sbSelectEq<Row>(TABLE, "user_id", userId, "*", 1);
  return byUserId[0] ?? null;
}

export async function getNavPreferencesForUser(
  userId: string,
  role: string
): Promise<UserNavPreferences> {
  const row = await findUserRow(userId);
  if (!row) return resolveNavPreferences(null, role);
  return resolveNavPreferences(parseRowPrefs(row.nav_preferences), role);
}

export async function setNavPreferencesForUser(
  userId: string,
  prefs: UserNavPreferences
): Promise<UserNavPreferences> {
  const row = await findUserRow(userId);
  if (!row) return prefs;
  await sbUpdateByPublicId(TABLE, publicId(row), {
    nav_preferences: JSON.parse(serializeNavPreferences(prefs)),
    updated_at: new Date().toISOString(),
  });
  return prefs;
}

export async function clearNavPreferencesForUser(userId: string): Promise<void> {
  const row = await findUserRow(userId);
  if (!row) return;
  await sbUpdateByPublicId(TABLE, publicId(row), {
    nav_preferences: null,
    updated_at: new Date().toISOString(),
  });
}
