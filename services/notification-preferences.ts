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
    quiet_hours_start: f.quiet_hours_start ?? "",
    quiet_hours_end: f.quiet_hours_end ?? "",
    mute_all: f.mute_all ?? false,
    updated_at: f.updated_at ?? "",
  };
}

export async function getPreferencesByUserId(userId: string): Promise<NotificationPreference | null> {
  const { records } = await listRecords<Fields>(TABLE, {
    filterByFormula: `{user_id} = "${userId.replace(/"/g, '""')}"`,
    pageSize: 1,
  });
  return records[0] ? mapRecord(records[0]) : null;
}

export async function listNotificationPreferences(params: ListParams & { filterByFormula?: string } = {}) {
  const { records, offset } = await listRecords<Fields>(TABLE, params);
  return { preferences: records.map(mapRecord), offset };
}

export async function createNotificationPreference(fields: Partial<Fields>) {
  const rec = await createRecord(TABLE, fields);
  return mapRecord(rec as AirtableRecord<Fields>);
}

export async function updateNotificationPreference(recordId: string, fields: Partial<Fields>) {
  const rec = await updateRecord(TABLE, recordId, fields);
  return mapRecord(rec as AirtableRecord<Fields>);
}

const DEFAULT_PREFERENCES: Partial<Fields> = {
  push_enabled: true,
  in_app_enabled: true,
  critical_only: false,
  whale_alerts: true,
  shift_alerts: true,
  model_alerts: true,
  system_alerts: true,
  task_alerts: true,
  mute_all: false,
  quiet_hours_start: "",
  quiet_hours_end: "",
};

/**
 * Create default notification_preferences for a user.
 * Call this when a new user is created in the users table (e.g. from Accounts or D1 sync).
 */
export async function createDefaultPreferencesForUser(userId: string): Promise<NotificationPreference> {
  const existing = await getPreferencesByUserId(userId);
  if (existing) return existing;
  const preferenceId = `pref_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return createNotificationPreference({
    preference_id: preferenceId,
    user_id: userId,
    ...DEFAULT_PREFERENCES,
  });
}
