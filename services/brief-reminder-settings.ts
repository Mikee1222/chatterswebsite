/**
 * Admin-editable reminder lead time for Recording / Editing Brief deadlines.
 */

import {
  BRIEF_REMINDER_LEAD_HOURS_DEFAULT,
  BRIEF_REMINDER_LEAD_HOURS_SETTING_KEY,
  parseReminderLeadHours,
} from "@/lib/brief-deadlines";
import { getSystemSetting, setSystemSetting } from "@/services/system-settings-supabase";

export async function getBriefReminderLeadHours(): Promise<number> {
  const raw = await getSystemSetting(BRIEF_REMINDER_LEAD_HOURS_SETTING_KEY).catch(() => null);
  return parseReminderLeadHours(raw);
}

export async function setBriefReminderLeadHours(hours: number): Promise<number> {
  const next = parseReminderLeadHours(String(hours));
  await setSystemSetting(
    BRIEF_REMINDER_LEAD_HOURS_SETTING_KEY,
    String(next),
    "Hours before deadline to send Recording/Editing Brief reminder (admin-editable).",
  );
  return next;
}
