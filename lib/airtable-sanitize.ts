/**
 * Sanitize payloads before sending to Airtable create/update.
 * Strips computed, formula, created time, last modified time, and other non-writable fields
 * to avoid INVALID_VALUE_FOR_COLUMN (e.g. "Field X cannot accept a value because the field is computed").
 *
 * ALL create/update flows go through createRecord/updateRecord in airtable-server.ts, which call
 * this sanitizer. When adding a new Airtable table or new computed fields, add them here.
 */

/** Normalize field name for comparison: lowercase, spaces -> underscore. Airtable may use "Created At" or "created_at". */
function normalizeFieldName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_").trim();
}

/** Date/time field names (normalized). Airtable cannot parse empty string for these – omit or send valid value only. */
const DATE_TIME_FIELD_NORMALIZED = new Set([
  "custom_start_time",
  "custom_end_time",
  "start_time",
  "end_time",
  "week_start",
  "created_at",
  "updated_at",
]);

function isDateTimeField(key: string): boolean {
  return DATE_TIME_FIELD_NORMALIZED.has(normalizeFieldName(key));
}

function isEmptyDateTimeValue(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

/**
 * If the value looks like a JSON-stringified string (e.g. "\"test\"" or '"test"'), return the
 * unwrapped string so Airtable receives a clean select/single-select value, not a string with
 * extra quotes (which causes INVALID_MULTIPLE_CHOICE_OPTIONS).
 */
function unwrapJsonStringifiedValue(value: unknown): unknown {
  if (typeof value !== "string" || value.length < 2) return value;
  const trimmed = value.trim();
  if (trimmed[0] !== '"' || trimmed[trimmed.length - 1] !== '"') return value;
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === "string" ? parsed : value;
  } catch {
    return value;
  }
}

/** Canonical (normalized) names that are computed/system-managed and must never be written. */
const GLOBAL_NON_WRITABLE_NORMALIZED = new Set([
  "created_at",
  "updated_at",
  "last_updated_by",
  "last_modified_by",
  "created_by",
  "total_minutes",
  "worked_minutes",
  "session_minutes",
  "total_hours_decimal",
  "models_count",
  "last_modified_time",
  "created_time",
]);

/**
 * Known single-select / multi-select fields and their allowed values (normalized key -> Set of allowed strings).
 * If a value is not in the set, it is omitted from the payload to avoid INVALID_MULTIPLE_CHOICE_OPTIONS.
 */
const SELECT_FIELD_ALLOWED_OPTIONS: Record<string, Set<string>> = {
  day: new Set([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ]),
  shift_type: new Set(["Morning", "Night", "Custom", "mistakes", "vault_cleaning", "other", "chatting"]),
  status: new Set([
    "submitted",
    "reviewed",
    "used",
    "rejected",
    "pending",
    "accepted",
    "recording",
    "completed",
    "delivered",
    "cancelled",
    "active",
    "completed",
    "Active",
    "Inactive",
    "Dead",
    "Deleted Account",
  ]),
  custom_type: new Set([
    "video",
    "photo_set",
    "voice_note",
    "rating",
    "special_request",
    "other",
  ]),
  priority: new Set(["low", "normal", "medium", "high", "urgent"]),
  platform: new Set(["onlyfans", "fanvue", "other"]),
  relationship_status: new Set(["New", "Angry", "In Love", "Intrestead", "Simp"]),
  hours_active: new Set(["7am - 10am", "10am-4pm", "4pm - 8pm", "8pm - 12am", "12am+"]),
  entry_type: new Set(["availability", "day_off"]),
};

function getAllowedOptionsForSelectField(normalizedKey: string): Set<string> | null {
  return SELECT_FIELD_ALLOWED_OPTIONS[normalizedKey] ?? null;
}

/** Per-table additional non-writable field names (normalized). Add any new table that has create/update. */
const TABLE_NON_WRITABLE_NORMALIZED: Record<string, Set<string>> = {
  shifts: new Set(["total_minutes", "total_hours_decimal", "worked_minutes", "updated_at", "created_at"]),
  shift_models: new Set(["session_minutes", "created_at", "updated_at"]),
  custom_requests: new Set(["created_at"]),
  modelss: new Set(["created_at", "updated_at"]),
  whales: new Set(["created_at", "updated_at", "last_updated_by"]),
  users: new Set(["created_at", "updated_at"]),
  whale_transactions: new Set(["created_at"]),
  activity_logs: new Set(["created_at"]),
  notifications: new Set(["created_at"]),
  notification_preferences: new Set(["updated_at"]),
  push_subscriptions: new Set(["created_at"]),
  weekly_program: new Set(["created_at", "updated_at"]),
  weekly_program_va: new Set(["created_at", "updated_at"]),
  weekly_availability_requests: new Set(["created_at"]),
  weekly_availability_requests_va: new Set(["created_at"]),
  staff_task_types: new Set(["created_at"]),
  monthly_targets: new Set(["created_at", "updated_at"]),
};

function getNonWritableNormalizedForTable(tableName: string): Set<string> {
  const combined = new Set<string>(GLOBAL_NON_WRITABLE_NORMALIZED);
  const tableSet = TABLE_NON_WRITABLE_NORMALIZED[tableName];
  if (tableSet) {
    tableSet.forEach((k) => combined.add(normalizeFieldName(k)));
  }
  return combined;
}

function isNonWritable(key: string, nonWritableNormalized: Set<string>): boolean {
  return nonWritableNormalized.has(normalizeFieldName(key));
}

/**
 * Sanitize a payload for Airtable create or update.
 * - Removes undefined values
 * - Removes keys that are computed/non-writable (case-insensitive, spaces normalized)
 * - Safe for any table: unknown tables still get GLOBAL_NON_WRITABLE stripped
 */
export function sanitizePayloadForAirtable<T extends Record<string, unknown>>(
  tableName: string,
  payload: T,
  _mode: "create" | "update"
): Record<string, unknown> {
  const nonWritable = getNonWritableNormalizedForTable(tableName);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    if (isNonWritable(key, nonWritable)) continue;
    if (isDateTimeField(key) && isEmptyDateTimeValue(value)) continue;
    let outValue: unknown = value;
    if (typeof value === "string") {
      outValue = unwrapJsonStringifiedValue(value);
    } else if (Array.isArray(value)) {
      outValue = value.map((item) =>
        typeof item === "string" ? unwrapJsonStringifiedValue(item) : item
      );
    }
    const normKey = normalizeFieldName(key);
    const allowed = getAllowedOptionsForSelectField(normKey);
    if (allowed != null) {
      if (typeof outValue === "string") {
        if (!allowed.has(outValue)) continue;
      } else if (Array.isArray(outValue)) {
        const filtered = (outValue as unknown[]).filter(
          (item): item is string => typeof item === "string" && allowed.has(item)
        );
        if (filtered.length === 0) continue;
        outValue = filtered;
      }
    }
    out[key] = outValue;
  }
  return out;
}
