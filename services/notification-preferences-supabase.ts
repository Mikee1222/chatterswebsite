/**
 * Supabase backend for services/notification-preferences.ts
 */
import {
  publicId,
  sbInsert,
  sbSelectEq,
  sbSelectAll,
  sbUpdateByPublicId,
  type SbRow,
} from "@/lib/supabase-data";
import {
  getFallbackNotificationDefaults,
  notificationDefaultsToPreferenceFields,
  parseEventOverrides,
} from "@/lib/notification-role-defaults";
import { getNotificationDefaultsForRole } from "@/services/roles";
import type { NotificationPreference } from "@/types";
import type { ListParams } from "@/lib/airtable-server";

const TABLE = "notification_preferences";

type Row = SbRow & {
  preference_id?: string | null;
  user_id?: string | null;
  push_enabled?: boolean | null;
  in_app_enabled?: boolean | null;
  critical_only?: boolean | null;
  whale_alerts?: boolean | null;
  shift_alerts?: boolean | null;
  model_alerts?: boolean | null;
  system_alerts?: boolean | null;
  task_alerts?: boolean | null;
  mistake_alerts?: boolean | null;
  fine_bonus_alerts?: boolean | null;
  period_alerts?: boolean | null;
  marketing_alerts?: boolean | null;
  phase_alerts?: boolean | null;
  reward_alerts?: boolean | null;
  custom_request_alerts?: boolean | null;
  billing_alerts?: boolean | null;
  training_alerts?: boolean | null;
  schedule_alerts?: boolean | null;
  event_overrides?: unknown;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  mute_all?: boolean | null;
  updated_at?: string | null;
};

function mapRow(row: Row): NotificationPreference {
  return {
    id: publicId(row),
    preference_id: row.preference_id ?? "",
    user_id: row.user_id ?? "",
    push_enabled: row.push_enabled ?? true,
    in_app_enabled: row.in_app_enabled ?? true,
    critical_only: row.critical_only ?? false,
    whale_alerts: row.whale_alerts ?? true,
    shift_alerts: row.shift_alerts ?? true,
    model_alerts: row.model_alerts ?? true,
    system_alerts: row.system_alerts ?? true,
    task_alerts: row.task_alerts ?? true,
    mistake_alerts: row.mistake_alerts !== false,
    fine_bonus_alerts: row.fine_bonus_alerts !== false,
    period_alerts: row.period_alerts !== false,
    marketing_alerts: row.marketing_alerts !== false,
    phase_alerts: row.phase_alerts !== false,
    reward_alerts: row.reward_alerts !== false,
    custom_request_alerts: row.custom_request_alerts !== false,
    billing_alerts: row.billing_alerts !== false,
    training_alerts: row.training_alerts !== false,
    schedule_alerts: row.schedule_alerts !== false,
    event_overrides: parseEventOverrides(row.event_overrides),
    quiet_hours_start: row.quiet_hours_start ?? "",
    quiet_hours_end: row.quiet_hours_end ?? "",
    mute_all: row.mute_all ?? false,
    updated_at: row.updated_at ?? "",
  };
}

function normalizeWriteFields(fields: Record<string, unknown>): Record<string, unknown> {
  if (!("event_overrides" in fields)) return fields;
  const raw = fields.event_overrides;
  if (raw == null) return { ...fields, event_overrides: {} };
  return { ...fields, event_overrides: parseEventOverrides(raw) };
}

export async function getPreferencesByUserId(userId: string): Promise<NotificationPreference | null> {
  const rows = await sbSelectEq<Row>(TABLE, "user_id", userId, "*", 1);
  if (rows[0]) return mapRow(rows[0]);

  // Dual-run: prefs.user_id may be airtable rec… while notify passes uuid (or vice versa).
  const trimmed = userId.trim();
  if (!trimmed) return null;
  try {
    const { sbAirtableIdsForUuids, sbUuidsForAirtableIds } = await import("@/lib/supabase-data");
    const aliases: string[] = [];
    if (trimmed.startsWith("rec")) {
      const uuids = await sbUuidsForAirtableIds("users", [trimmed]);
      aliases.push(...uuids.filter((id) => id && id !== trimmed));
    } else {
      const ats = await sbAirtableIdsForUuids("users", [trimmed]);
      aliases.push(...ats.filter((id) => id && id !== trimmed));
    }
    for (const alt of [...new Set(aliases)]) {
      const altRows = await sbSelectEq<Row>(TABLE, "user_id", alt, "*", 1);
      if (altRows[0]) return mapRow(altRows[0]);
    }
  } catch {
    /* identity resolve failed — treat as no prefs */
  }
  return null;
}

export async function listNotificationPreferences(
  _params: ListParams & { filterByFormula?: string } = {}
) {
  void _params;
  const rows = await sbSelectAll<Row>(TABLE);
  return { preferences: rows.map(mapRow), offset: undefined as string | undefined };
}

export async function createNotificationPreference(fields: Partial<Row> & { event_overrides?: unknown }) {
  const row = await sbInsert<Row>(TABLE, normalizeWriteFields(fields as Record<string, unknown>));
  return mapRow(row);
}

export async function updateNotificationPreference(
  recordId: string,
  fields: Partial<Row> & { event_overrides?: unknown }
) {
  const row = await sbUpdateByPublicId<Row>(TABLE, recordId, {
    ...normalizeWriteFields(fields as Record<string, unknown>),
    updated_at: new Date().toISOString(),
  });
  return mapRow(row);
}

const BASE_PREFERENCES: Partial<Row> = {
  push_enabled: true,
  in_app_enabled: true,
  critical_only: false,
  mute_all: false,
  quiet_hours_start: "",
  quiet_hours_end: "",
};

async function resolveCategoryDefaults(roleName?: string): Promise<Partial<Row>> {
  const defaults = roleName
    ? await getNotificationDefaultsForRole(roleName)
    : getFallbackNotificationDefaults("");
  return notificationDefaultsToPreferenceFields(defaults) as Partial<Row>;
}

export async function createDefaultPreferencesForUser(
  userId: string,
  roleName?: string
): Promise<NotificationPreference> {
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
