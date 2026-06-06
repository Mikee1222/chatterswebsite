import { getSystemSetting, setSystemSetting } from "@/services/system-settings";

const SETTING_KEY = "admin_notification_ids";

function parseIdsFromEnv(): string[] {
  const raw = process.env.ADMIN_AIRTABLE_USER_IDS;
  if (raw == null || String(raw).trim() === "") return [];
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Admin notification recipients: JSON array in system_settings, else comma-separated ADMIN_AIRTABLE_USER_IDS env. */
export async function getAdminNotificationIds(): Promise<string[]> {
  const stored = await getSystemSetting(SETTING_KEY);
  if (stored != null && stored.trim() !== "") {
    try {
      const parsed = JSON.parse(stored) as unknown;
      if (Array.isArray(parsed)) {
        const ids = [...new Set(parsed.map((x) => String(x).trim()).filter(Boolean))];
        if (ids.length > 0) return ids;
      }
    } catch {
      /* invalid JSON → env */
    }
  }
  return parseIdsFromEnv();
}

export async function setAdminNotificationIds(ids: string[]): Promise<void> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  await setSystemSetting(
    SETTING_KEY,
    JSON.stringify(unique),
    "JSON array of Airtable users table record IDs who receive admin-wide notifications (notifyAdmins).");
}
