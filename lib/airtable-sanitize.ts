/**
 * Sanitize payloads before sending to Airtable create/update.
 * Strips computed, formula, created time, last modified time, and other non-writable fields
 * to avoid INVALID_VALUE_FOR_COLUMN (e.g. "Field X cannot accept a value because the field is computed").
 *
 * ALL create/update flows go through createRecord/updateRecord in airtable-server.ts, which call
 * this sanitizer. When adding a new Airtable table or new computed fields, add them here.
 */

import { NOTIFICATIONS_TABLE } from "@/lib/notifications-schema";
import { isTimeOnlyString } from "@/lib/airtable-datetime";
import {
  MODEL_LIVE_STREAM_PLATFORM_OPTIONS,
  MODEL_LIVE_STREAM_STATUS_OPTIONS,
  MODEL_TASK_TYPE_OPTIONS,
  TRANSACTION_CURRENCY_OPTIONS,
  TRANSACTION_TYPES,
  WHALE_STATUS_OPTIONS,
} from "@/lib/airtable-options";

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
  "read_at",
  "model_scheduled_date",
  "model_scheduled_start",
  "model_scheduled_end",
  "planned_start",
  "planned_end",
  "actual_start",
  "actual_end",
  "deadline_requested",
  "deadline",
  "scheduled_date",
  "date",
  "due_date",
  "completed_at",
  "recurrence_end_date",
  "start_date",
  "end_date",
  "break_reminder_at",
  "mistake_date",
  "reviewed_at",
  "scheduled_time",
  "last_updated",
  "subscribed_at",
  "expires_at",
  "last_synced_at",
]);

function isDateTimeField(key: string): boolean {
  return DATE_TIME_FIELD_NORMALIZED.has(normalizeFieldName(key));
}

function isEmptyDateTimeValue(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

/** Omit time-only strings (e.g. "10:00") from datetime fields – Airtable expects full ISO. */
function isInvalidDateTimeValue(key: string, value: unknown): boolean {
  if (isEmptyDateTimeValue(value)) return true;
  if (isDateTimeField(key) && isTimeOnlyString(value)) return true;
  return false;
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
    "inactive",
    "Dead",
    "Deleted Account",
    "scheduled",
    "waiting_schedule",
    "in_progress",
    "blocked",
    "done",
    "skipped",
  ]),
  model_status: new Set(["waiting_schedule", "scheduled", "in_progress", "completed", "uploaded", "declined"]),
  item_type: new Set([
    "script",
    "mass_message",
    "live_stream",
    "custom",
    "content_shoot",
    "promo",
    "meeting",
    "rest",
    "time_off",
    "other",
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
  recurrence_type: new Set(["daily", "weekly", "monthly", "custom"]),
  recurrence_days: new Set([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ]),
  platform: new Set(["onlyfans", "fanvue", "other"]),
  relationship_status: new Set(["New", "Angry", "In Love", "Interested", "Simp"]),
  hours_active: new Set(["7am - 10am", "10am-4pm", "4pm - 8pm", "8pm - 12am", "12am+"]),
  entry_type: new Set(["availability", "day_off", "live_window", "custom_window"]),
};

/** Table-specific overrides for select fields (when a field name is used with different options per table). */
const TABLE_SELECT_FIELD_OVERRIDES: Record<string, Record<string, Set<string>>> = {
  model_live_streams: {
    platform: new Set(MODEL_LIVE_STREAM_PLATFORM_OPTIONS),
    status: new Set([...MODEL_LIVE_STREAM_STATUS_OPTIONS]),
  },
  model_tasks: {
    type: new Set(MODEL_TASK_TYPE_OPTIONS),
  },
  chatter_points: {
    level: new Set(["Bronze", "Silver", "Gold", "Diamond"]),
  },
  points_transactions: {
    category: new Set(["shift", "whale", "custom", "streak", "challenge", "manual", "penalty", "spin", "mistake"]),
  },
  challenges: {
    target_metric: new Set([
      "transactions",
      "whales_added",
      "shift_hours",
      "customs_completed",
      "whale_status_upgrades",
    ]),
  },
  spin_wheel_prizes: {
    prize_type: new Set([
      "cash",
      "extra_break",
      "double_points",
      "mystery",
      "points",
      /** Newer bases / manual Airtable options */
      "custom",
      "bonus",
      "break",
    ]),
  },
  feedback: {
    user_role: new Set(["chatter", "virtual_assistant", "model", "admin"]),
    type: new Set(["bug", "suggestion", "other"]),
    status: new Set(["new", "in_review", "resolved", "wont_fix"]),
  },
  rebills: {
    sub_type: new Set(["paid", "free", "free_trial"]),
    status: new Set(["pending", "verified", "rejected"]),
  },
  tips: {
    status: new Set(["pending", "verified", "rejected"]),
  },
  payment_submissions: {
    status: new Set(["pending_review", "approved", "rejected"]),
  },
  payment_methods: {
    type: new Set(["Bank", "Crypto"]),
  },
  billing_cycles: {
    status: new Set(["draft", "announced", "pending_review", "confirmed_paid", "overdue"]),
    kind: new Set(["chatting_weekly", "crm_monthly"]),
  },
  billing_cycle_revenues: {
    status: new Set(["draft", "announced", "pending_review", "confirmed_paid", "overdue"]),
  },
  model_content_requests: {
    type: new Set(["script", "mass", "photo_set", "video", "other"]),
    status: new Set(["pending", "approved", "rejected", "in_progress", "completed"]),
  },
  model_expense_requests: {
    type: new Set(["airbnb", "other"]),
    status: new Set(["pending", "approved", "rejected"]),
  },
  model_personal_events: {
    event_type: new Set(["nails", "lashes", "hairdresser", "surgery", "fillers", "custom"]),
  },
  shift_queue: {
    status: new Set(["waiting", "started", "cancelled", "expired"]),
    queue_type: new Set(["full_start", "add_models"]),
  },
  va_tasks: {
    status: new Set(["pending", "in_progress", "done", "skipped"]),
    priority: new Set(["low", "normal", "high", "urgent"]),
    recurrence_type: new Set(["daily", "weekly", "monthly", "custom"]),
    recurrence_days: new Set([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]),
  },
  model_periods: {
    logged_by: new Set(["model", "admin", "va"]),
  },
  va_content_assignments: {
    status: new Set(["pending", "pending_approval", "rejected", "scheduled", "completed", "cancelled"]),
    priority: new Set(["low", "normal", "high", "urgent"]),
    content_type: new Set(["PDF", "Video Script", "Photo Guide", "Other"]),
  },
  whale_transactions: {
    type: new Set(TRANSACTION_TYPES as unknown as string[]),
    currency: new Set(TRANSACTION_CURRENCY_OPTIONS as unknown as string[]),
  },
  chatter_mistakes: {
    status: new Set(["pending", "approved", "rejected"]),
    reason_category: new Set(["Low", "Medium", "High"]),
  },
  mistake_reasons: {
    category: new Set(["Low", "Medium", "High"]),
  },
  fines_and_bonuses: {
    user_role: new Set(["chatter", "va"]),
    type: new Set(["bonus", "fine"]),
    category: new Set(["extra_revenue", "standard"]),
    status: new Set(["pending_review", "approved", "rejected"]),
    source: new Set(["chatter_submission", "admin", "spin_wheel"]),
    payment_method: new Set(["PayPal", "Revolut", "Other"]),
  },
  model_social_accounts: {
    account_type: new Set(["main", "secondary"]),
    region: new Set(["USA", "Greek", "Global"]),
    account_status: new Set(["active", "shadowbanned", "banned"]),
    platform: new Set([
      "Instagram",
      "Facebook",
      "TikTok",
      "Twitter",
      "YouTube",
      "Snapchat",
      "Other",
      "Telegram",
      "GetMyLinks",
    ]),
  },
  shadowban_reports: {
    status: new Set(["pending", "approved", "dismissed"]),
  },
  model_funnel_links: {
    region: new Set(["USA", "Greek", "Global"]),
  },
  va_task_phases: {
    status: new Set(["pending", "in_progress", "completed", "overdue"]),
    region: new Set(["USA", "Greek", "Global"]),
  },
  va_task_phase_items: {
    status: new Set(["pending", "completed"]),
  },
  mass_lists: {
    type: new Set(["include", "exclude"]),
  },
  model_tiers: {
    tier: new Set(["high", "medium", "low"]),
  },
  of_subscribers: {
    category: new Set(["whale", "vip", "high_spender", "medium", "freeloader", "new"]),
  },
  pricing_rows: {
    model_tier: new Set(["high", "medium", "low"]),
    spender_tier: new Set(["high", "medium", "low", "medium_low"]),
  },
  clients: {
    status: new Set(["active", "inactive"]),
  },
  whales: {
    status: new Set(WHALE_STATUS_OPTIONS as unknown as string[]),
  },
};

function getAllowedOptionsForSelectField(normalizedKey: string, tableName?: string): Set<string> | null {
  if (tableName && TABLE_SELECT_FIELD_OVERRIDES[tableName]?.[normalizedKey]) {
    return TABLE_SELECT_FIELD_OVERRIDES[tableName][normalizedKey];
  }
  return SELECT_FIELD_ALLOWED_OPTIONS[normalizedKey] ?? null;
}

/** Per-table additional non-writable field names (normalized). Add any new table that has create/update. */
const TABLE_NON_WRITABLE_NORMALIZED: Record<string, Set<string>> = {
  shifts: new Set(["total_minutes", "total_hours_decimal", "worked_minutes", "updated_at", "created_at"]),
  shift_models: new Set(["session_minutes", "created_at", "updated_at"]),
  modelss: new Set(["created_at", "updated_at"]),
  model_schedule: new Set(["created_at", "updated_at"]),
  model_tasks: new Set(["created_at", "updated_at"]),
  model_live_streams: new Set(["created_at", "updated_at"]),
  whales: new Set(["created_at", "updated_at", "last_updated_by"]),
  users: new Set(["created_at", "updated_at"]),
  whale_transactions: new Set(["created_at"]),
  activity_logs: new Set(["created_at"]),
  [NOTIFICATIONS_TABLE]: new Set(["created_at"]),
  notification_preferences: new Set(["updated_at"]),
  push_subscriptions: new Set(["created_at"]),
  weekly_program: new Set(["created_at", "updated_at"]),
  weekly_program_va: new Set(["created_at", "updated_at"]),
  weekly_availability_requests: new Set(["created_at"]),
  weekly_availability_requests_va: new Set(["created_at"]),
  weekly_availability_requests_models: new Set(["created_at"]),
  model_time_off_requests: new Set(["created_at"]),
  staff_task_types: new Set(["created_at"]),
  monthly_targets: new Set(["created_at", "updated_at"]),
  va_tasks: new Set(["created_at"]),
  model_periods: new Set(["created_at"]),
  va_content_assignments: new Set(["created_at", "updated_at"]),
  chatter_points: new Set(["created_at", "updated_at"]),
  points_transactions: new Set(["updated_at"]),
  challenges: new Set(["created_at", "updated_at"]),
  challenge_progress: new Set(["created_at"]),
  spin_wheel_prizes: new Set(["created_at", "updated_at"]),
  spin_wheel_spins: new Set(["updated_at"]),
  model_personal_events: new Set(["created_at"]),
  payment_methods: new Set(["payment_submissions", "invoices"]),
};

/** Tables where a normally global-stripped field is a normal writable column. */
const TABLE_WRITABLE_FIELD_EXCEPTIONS: Record<string, Set<string>> = {
  challenges: new Set(["created_by"]),
  points_transactions: new Set(["created_at"]),
  spin_wheel_spins: new Set(["created_at"]),
  feedback: new Set(["created_at"]),
  rebills: new Set(["created_at"]),
  tips: new Set(["created_at"]),
  /** Allow client-bumped `updated_at` (blocked globally); keep `created_at` non-writable. */
  custom_requests: new Set(["updated_at"]),
  model_content_requests: new Set(["created_at", "updated_at"]),
  model_expense_requests: new Set(["created_at", "updated_at"]),
  model_personal_events: new Set(["created_at"]),
  marketing_platforms: new Set(["created_at"]),
  model_social_accounts: new Set(["created_at", "last_updated"]),
  model_funnel_links: new Set(["created_at"]),
  shadowban_reports: new Set(["created_at", "reviewed_at"]),
  va_task_phases: new Set(["created_at", "completed_at", "scheduled_time", "start_time", "end_time"]),
  va_task_phase_items: new Set(["created_at", "completed_at"]),
  /** Server sets mistake timestamps explicitly. */
  chatter_mistakes: new Set(["created_at", "updated_at"]),
  fines_and_bonuses: new Set(["created_at"]),
  mass_lists: new Set(["created_at"]),
  shift_queue: new Set(["created_at", "started_at", "cancelled_at"]),
  /** Allow `updated_at` for optimistic concurrency / debounce in progress updates. */
  challenge_progress: new Set(["updated_at"]),
  /** Break reminder ISO datetime; explicit so payloads are never treated as non-writable elsewhere. */
  shifts: new Set(["break_reminder_at"]),
  /** Display name / email of who created the whale row (set on create). */
  whales: new Set(["created_by"]),
};

function getNonWritableNormalizedForTable(tableName: string): Set<string> {
  const combined = new Set<string>(GLOBAL_NON_WRITABLE_NORMALIZED);
  const exceptions = TABLE_WRITABLE_FIELD_EXCEPTIONS[tableName];
  if (exceptions) {
    for (const k of exceptions) {
      combined.delete(normalizeFieldName(k));
    }
  }
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
    if (isDateTimeField(key) && isInvalidDateTimeValue(key, value)) continue;
    let outValue: unknown = value;
    if (typeof value === "string") {
      outValue = unwrapJsonStringifiedValue(value);
    } else if (Array.isArray(value)) {
      outValue = value.map((item) =>
        typeof item === "string" ? unwrapJsonStringifiedValue(item) : item
      );
    }
    const normKey = normalizeFieldName(key);
    const allowed = getAllowedOptionsForSelectField(normKey, tableName);
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
