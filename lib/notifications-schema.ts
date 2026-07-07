/**
 * Centralized schema contract for the Airtable notifications table.
 * All notification create/list/update code should use these constants
 * to avoid drift from the real Airtable schema.
 */

import { NOTIFICATION_EVENTS_WITH_ADMIN_VARIANT } from "@/lib/notification-admin-variants";

// --- Table name ---
export const NOTIFICATIONS_TABLE = "notifications" as const;

// --- Field names (must match Airtable column names exactly: same spelling, case, and no extra spaces) ---
// If Airtable returns UNKNOWN_FIELD_NAME, rename the column in Airtable to match (e.g. "event_type" not "Event type").
export const NOTIFICATION_FIELDS = {
  notification_id: "notification_id",
  user_id: "user_id",
  category: "category",
  event_type: "event_type",
  priority: "priority",
  title: "title",
  body: "body",
  entity_type: "entity_type",
  entity_id: "entity_id",
  read_at: "read_at",
  created_at: "created_at",
  /** Optional. Add a Long text column "metadata" in Airtable to store JSON array of { label, value }. */
  metadata: "metadata",
} as const;

export type NotificationFieldName = keyof typeof NOTIFICATION_FIELDS;

/** Event types allowed in Airtable single select (event_type). Add new options in Airtable UI if you extend this. */
export const NOTIFICATION_EVENT_TYPES = [
  "shift_started",
  "shift_ended",
  "shift_late",
  "shift_no_show",
  "model_became_free",
  "model_taken",
  "model_live_started",
  "model_live_ended",
  "whale_registered",
  "whale_assigned",
  "custom_request_created",
  "custom_request_updated",
  "period_3_day_reminder",
  "period_predicted_day",
  "period_confirmed_early",
  "period_overdue",
  "period_prediction_reset",
  "system_alert",
  "task_shift_started",
  "task_shift_ended",
  // Distinct task/phase lifecycle options (A7). Require matching Airtable single-select choices.
  "task_completed",
  "task_overdue",
  "tasks_not_started",
  "va_task_reminder",
  "va_task_assigned",
  "phase_task_completed",
  "phase_completed",
  "phase_overdue",
  "all_phases_completed",
  // Model content request lifecycle (C3).
  "model_content_request_created",
  "model_content_request_reviewed",
  "billing_due_reminder",
  "va_content_scheduled",
  "va_content_completed",
  "custom_request_uploaded",
  "chatter_mistake",
  "chatter_mistake_reviewed",
  "fine_issued",
  "bonus_awarded",
  "fine_bonus_reviewed",
  "shadowban_report",
  "shadowban_submitted",
  "shadowban_resolved",
  "shadowban_lifted_reported",
  "sop_quiz_passed",
  "sop_quiz_failed",
  "schedule_published",
  "winner_video_approved",
  "winner_video_rejected",
  "spin_result",
  "login_new_device",
  "password_changed",
  "payment_rejected",
  // Winner videos / research (P2 coverage).
  "winner_video_submitted",
  "research_assigned_to_creative",
  // Creative scripts lifecycle (P2 coverage).
  "creative_script_submitted",
  "creative_script_approved",
  "creative_script_rejected",
  "creative_script_resubmitted",
  // Marketing spot checks (P2 coverage).
  "spot_check_logged",
  "spot_check_status_changed",
  ...NOTIFICATION_EVENTS_WITH_ADMIN_VARIANT.map((base) => `${base}_admin`),
] as const;

export type NotificationEventTypeAirtable = (typeof NOTIFICATION_EVENT_TYPES)[number];

/** Categories allowed in Airtable single select (category). */
export const NOTIFICATION_CATEGORIES = [
  "shift",
  "model",
  "whale",
  "custom_request",
  "system",
  "task",
  "billing",
] as const;

export type NotificationCategoryAirtable = (typeof NOTIFICATION_CATEGORIES)[number];

/** Map internal/operational event types to Airtable event_type single-select (for writes). */
const EVENT_TYPE_TO_AIRTABLE_BASE: Record<string, NotificationEventTypeAirtable> = {
  shift_started: "shift_started",
  shift_ended: "shift_ended",
  break_started: "shift_started",
  break_ended: "shift_ended",
  shift_late: "shift_late",
  shift_no_show: "shift_no_show",
  shift_overtime: "shift_late",
  shift_running_long: "shift_late",
  chatter_no_models: "shift_no_show",
  break_exceeded: "shift_started",
  break_too_long: "shift_started",
  model_became_free: "model_became_free",
  model_taken: "model_taken",
  model_live_started: "model_live_started",
  model_live_ended: "model_live_ended",
  model_live_scheduled: "model_became_free",
  model_missed_live: "model_taken",
  model_content_completed: "task_shift_ended",
  model_content_scheduled: "task_shift_started",
  model_content_request_created: "model_content_request_created",
  model_content_request_reviewed: "model_content_request_reviewed",
  va_content_assigned: "task_shift_started",
  va_task_assigned: "va_task_assigned",
  va_content_scheduled: "va_content_scheduled",
  va_content_completed: "va_content_completed",
  custom_request_uploaded: "custom_request_uploaded",
  whale_registered: "whale_registered",
  whale_assigned: "whale_assigned",
  whale_followup: "whale_assigned",
  whale_spent: "whale_assigned",
  whale_session_submitted: "whale_assigned",
  custom_request_created: "custom_request_created",
  custom_request_submitted: "custom_request_created",
  custom_request_updated: "custom_request_updated",
  custom_status_changed: "custom_request_updated",
  custom_approved: "custom_request_updated",
  custom_rejected: "custom_request_updated",
  custom_declined: "custom_request_updated",
  custom_edited: "custom_request_updated",
  custom_uploaded: "custom_request_updated",
  custom_scheduled: "custom_request_updated",
  custom_deadline_approaching: "custom_request_updated",
  custom_overdue: "custom_request_updated",
  period_3_day_reminder: "period_3_day_reminder",
  period_predicted_day: "period_predicted_day",
  period_confirmed_early: "period_confirmed_early",
  period_overdue: "period_overdue",
  period_prediction_reset: "period_prediction_reset",
  form_submitted: "system_alert",
  schedule_updated: "system_alert",
  weekly_availability_friday_reminder: "system_alert",
  availability_submitted: "system_alert",
  shift_starting_soon: "system_alert",
  system_alert: "system_alert",
  account_update: "system_alert",
  user_created: "system_alert",
  role_changed: "system_alert",
  account_deleted: "system_alert",
  daily_summary: "system_alert",
  task_started: "task_shift_started",
  task_finished: "task_shift_ended",
  task_shift_started: "task_shift_started",
  task_shift_ended: "task_shift_ended",
  task_completed: "task_completed",
  task_overdue: "task_overdue",
  tasks_not_started: "tasks_not_started",
  va_task_reminder: "va_task_reminder",
  phase_task_completed: "phase_task_completed",
  phase_completed: "phase_completed",
  phase_overdue: "phase_overdue",
  all_phases_completed: "all_phases_completed",
  points_awarded: "system_alert",
  level_up: "system_alert",
  spin_available: "system_alert",
  challenge_completed: "system_alert",
  spin_result: "spin_result",
  billing_cycle_announced: "system_alert",
  billing_due_reminder: "billing_due_reminder",
  billing_payment_submitted: "system_alert",
  payment_submitted: "system_alert",
  payment_confirmed: "system_alert",
  payment_rejected: "payment_rejected",
  sop_academy_reminder: "system_alert",
  sop_academy_training_complete: "system_alert",
  sop_academy_signed_off: "system_alert",
  expense_approved: "system_alert",
  expense_rejected: "system_alert",
  chatter_mistake: "chatter_mistake",
  chatter_mistake_reviewed: "chatter_mistake_reviewed",
  fine_issued: "fine_issued",
  bonus_awarded: "bonus_awarded",
  fine_bonus_reviewed: "fine_bonus_reviewed",
  shadowban_report: "shadowban_report",
  shadowban_submitted: "shadowban_submitted",
  shadowban_resolved: "shadowban_resolved",
  shadowban_lifted_reported: "shadowban_lifted_reported",
  sop_quiz_passed: "sop_quiz_passed",
  sop_quiz_failed: "sop_quiz_failed",
  schedule_published: "schedule_published",
  login_new_device: "login_new_device",
  password_changed: "password_changed",
  winner_video_approved: "winner_video_approved",
  winner_video_rejected: "winner_video_rejected",
  winner_video_submitted: "winner_video_submitted",
  research_assigned_to_creative: "research_assigned_to_creative",
  creative_script_submitted: "creative_script_submitted",
  creative_script_approved: "creative_script_approved",
  creative_script_rejected: "creative_script_rejected",
  creative_script_resubmitted: "creative_script_resubmitted",
  spot_check_logged: "spot_check_logged",
  spot_check_status_changed: "spot_check_status_changed",
};

export const EVENT_TYPE_TO_AIRTABLE: Record<string, NotificationEventTypeAirtable> = {
  ...EVENT_TYPE_TO_AIRTABLE_BASE,
  ...Object.fromEntries(
    NOTIFICATION_EVENTS_WITH_ADMIN_VARIANT.map((base) => {
      const adminKey = `${base}_admin`;
      return [adminKey, EVENT_TYPE_TO_AIRTABLE_BASE[base] ?? base];
    })
  ),
};

/** Map legacy category to Airtable category (task_shift -> task, account -> system). */
export const CATEGORY_TO_AIRTABLE: Record<string, NotificationCategoryAirtable> = {
  shift: "shift",
  task_shift: "task",
  model: "model",
  whale: "whale",
  custom_request: "custom_request",
  system: "system",
  account: "system",
  /** Airtable category select has no "billing"; store as system. */
  billing: "system",
};

export type NotificationCreatePayload = {
  [NOTIFICATION_FIELDS.notification_id]: string;
  [NOTIFICATION_FIELDS.user_id]: string;
  [NOTIFICATION_FIELDS.category]: NotificationCategoryAirtable;
  [NOTIFICATION_FIELDS.event_type]: NotificationEventTypeAirtable;
  [NOTIFICATION_FIELDS.priority]: string;
  [NOTIFICATION_FIELDS.title]: string;
  [NOTIFICATION_FIELDS.body]: string;
  [NOTIFICATION_FIELDS.entity_type]: string;
  [NOTIFICATION_FIELDS.entity_id]: string;
};

export type NotificationValidationResult =
  | { valid: true }
  | { valid: false; error: string; code: string };

/**
 * Validate payload before writing to Airtable. Returns valid: false with a clear error
 * so callers can log and skip without crashing.
 */
export function validateNotificationPayload(payload: {
  user_id?: string;
  category?: string;
  event_type?: string;
  priority?: string;
  title?: string;
  body?: string;
  entity_type?: string;
  entity_id?: string;
}): NotificationValidationResult {
  if (!payload.user_id || String(payload.user_id).trim() === "") {
    return { valid: false, error: "user_id is required and must be non-empty", code: "MISSING_USER_ID" };
  }
  if (!payload.category || String(payload.category).trim() === "") {
    return { valid: false, error: "category is required and must be non-empty", code: "MISSING_CATEGORY" };
  }
  if (!NOTIFICATION_CATEGORIES.includes(payload.category as NotificationCategoryAirtable)) {
    return {
      valid: false,
      error: `category must be one of: ${NOTIFICATION_CATEGORIES.join(", ")}`,
      code: "INVALID_CATEGORY",
    };
  }
  if (!payload.event_type || String(payload.event_type).trim() === "") {
    return { valid: false, error: "event_type is required and must be non-empty", code: "MISSING_EVENT_TYPE" };
  }
  const eventAirtable = EVENT_TYPE_TO_AIRTABLE[payload.event_type] ?? payload.event_type;
  if (!NOTIFICATION_EVENT_TYPES.includes(eventAirtable as NotificationEventTypeAirtable)) {
    return {
      valid: false,
      error: `event_type must be one of: ${NOTIFICATION_EVENT_TYPES.join(", ")} (got: ${payload.event_type})`,
      code: "INVALID_EVENT_TYPE",
    };
  }
  if (payload.priority === undefined || payload.priority === null || String(payload.priority).trim() === "") {
    return { valid: false, error: "priority is required", code: "MISSING_PRIORITY" };
  }
  if (payload.title === undefined || payload.title === null) {
    return { valid: false, error: "title is required", code: "MISSING_TITLE" };
  }
  if (payload.body === undefined || payload.body === null) {
    return { valid: false, error: "body is required", code: "MISSING_BODY" };
  }
  if (payload.entity_type === undefined || payload.entity_type === null) {
    return { valid: false, error: "entity_type is required", code: "MISSING_ENTITY_TYPE" };
  }
  if (payload.entity_id === undefined || payload.entity_id === null) {
    return { valid: false, error: "entity_id is required", code: "MISSING_ENTITY_ID" };
  }
  return { valid: true };
}
