"use server";

import {
  listRecords,
  listAllRecords,
  getRecord,
  createRecord,
  updateRecord,
  type AirtableRecord,
  type ListParams,
} from "@/lib/airtable-server";
import { isSupabaseBackend } from "@/lib/data-backend";
import {
  getFallbackNotificationDefaults,
  notificationDefaultsToPreferenceFields,
  parseEventOverrides,
  serializeEventOverrides,
} from "@/lib/notification-role-defaults";
import { getNotificationDefaultsForRole } from "@/services/roles";
import type { NotificationPreference } from "@/types";

const TABLE = "notification_preferences";

type Fields = {
  preference_id?: string;
  user_id?: string;
  push_enabled?: boolean;
  in_app_enabled?: boolean;
  critical_only?: boolean;
  whale_alerts?: boolean;
  shift_alerts?: boolean;
  model_alerts?: boolean;
  system_alerts?: boolean;
  task_alerts?: boolean;
  mistake_alerts?: boolean;
  fine_bonus_alerts?: boolean;
  period_alerts?: boolean;
  marketing_alerts?: boolean;
  phase_alerts?: boolean;
  reward_alerts?: boolean;
  custom_request_alerts?: boolean;
  billing_alerts?: boolean;
  training_alerts?: boolean;
  schedule_alerts?: boolean;
  event_overrides?: string | NotificationPreference["event_overrides"];
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  mute_all?: boolean;
  updated_at?: string;
};

function mapRecord(rec: AirtableRecord<Fields>): NotificationPreference {
  const f = rec.fields;
  return {
    id: rec.id,
    preference_id: f.preference_id ?? "",
    user_id: f.user_id ?? "",
    push_enabled: f.push_enabled ?? true,
    in_app_enabled: f.in_app_enabled ?? true,
    critical_only: f.critical_only ?? false,
    whale_alerts: f.whale_alerts ?? true,
    shift_alerts: f.shift_alerts ?? true,
    model_alerts: f.model_alerts ?? true,
    system_alerts: f.system_alerts ?? true,
    task_alerts: f.task_alerts ?? true,
    mistake_alerts: f.mistake_alerts !== false,
    fine_bonus_alerts: f.fine_bonus_alerts !== false,
    period_alerts: f.period_alerts !== false,
    marketing_alerts: f.marketing_alerts !== false,
    phase_alerts: f.phase_alerts !== false,
    reward_alerts: f.reward_alerts !== false,
    custom_request_alerts: f.custom_request_alerts !== false,
    billing_alerts: f.billing_alerts !== false,
    training_alerts: f.training_alerts !== false,
    schedule_alerts: f.schedule_alerts !== false,
    event_overrides: parseEventOverrides(f.event_overrides),
    quiet_hours_start: f.quiet_hours_start ?? "",
    quiet_hours_end: f.quiet_hours_end ?? "",
    mute_all: f.mute_all ?? false,
    updated_at: f.updated_at ?? "",
  };
}

function normalizeWriteFields(fields: Partial<Fields> & { event_overrides?: unknown }): Partial<Fields> {
  const next = { ...fields } as Partial<Fields> & { event_overrides?: unknown };
  if ("event_overrides" in next) {
    const raw = next.event_overrides;
    if (typeof raw === "string") {
      next.event_overrides = raw;
    } else {
      next.event_overrides = serializeEventOverrides(parseEventOverrides(raw));
    }
  }
  return next as Partial<Fields>;
}

export async function getPreferencesByUserId(userId: string): Promise<NotificationPreference | null> {
  if (isSupabaseBackend()) return (await import("./notification-preferences-supabase")).getPreferencesByUserId(userId);
  const { records } = await listRecords<Fields>(TABLE, {
    filterByFormula: `{user_id} = "${userId.replace(/"/g, '""')}"`,
    pageSize: 1,
  });
  return records[0] ? mapRecord(records[0]) : null;
}

export async function listNotificationPreferences(params: ListParams & { filterByFormula?: string } = {}) {
  if (isSupabaseBackend()) return (await import("./notification-preferences-supabase")).listNotificationPreferences(params);
  const { records, offset } = await listRecords<Fields>(TABLE, params);
  return { preferences: records.map(mapRecord), offset };
}

export async function createNotificationPreference(fields: Partial<Fields> & { event_overrides?: unknown }) {
  if (isSupabaseBackend()) return (await import("./notification-preferences-supabase")).createNotificationPreference(fields);
  const rec = await createRecord(TABLE, normalizeWriteFields(fields));
  return mapRecord(rec as AirtableRecord<Fields>);
}

export async function updateNotificationPreference(
  recordId: string,
  fields: Partial<Fields> & { event_overrides?: unknown }
) {
  if (isSupabaseBackend()) return (await import("./notification-preferences-supabase")).updateNotificationPreference(recordId, fields);
  const rec = await updateRecord(TABLE, recordId, normalizeWriteFields(fields));
  return mapRecord(rec as AirtableRecord<Fields>);
}

const BASE_PREFERENCES: Partial<Fields> = {
  push_enabled: true,
  in_app_enabled: true,
  critical_only: false,
  mute_all: false,
  quiet_hours_start: "",
  quiet_hours_end: "",
};

async function resolveCategoryDefaults(roleName?: string): Promise<Partial<Fields>> {
  const defaults = roleName
    ? await getNotificationDefaultsForRole(roleName)
    : getFallbackNotificationDefaults("");
  return notificationDefaultsToPreferenceFields(defaults) as Partial<Fields>;
}

/**
 * Create default notification_preferences for a user.
 * Call this when a new user is created in the users table (e.g. from Accounts or D1 sync).
 */
export async function createDefaultPreferencesForUser(
  userId: string,
  roleName?: string
): Promise<NotificationPreference> {
  if (isSupabaseBackend()) return (await import("./notification-preferences-supabase")).createDefaultPreferencesForUser(userId, roleName);
  const existing = await getPreferencesByUserId(userId);
  if (existing) return existing;
  const preferenceId = `pref_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const categoryDefaults = await resolveCategoryDefaults(roleName);
  return createNotificationPreference({
    preference_id: preferenceId,
    user_id: userId,
    ...BASE_PREFERENCES,
    ...categoryDefaults,
  });
}
