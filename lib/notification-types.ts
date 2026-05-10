/**
 * Central notification type constants and payload shape for operational notifications.
 * Event types are mapped to Airtable via lib/notifications-schema EVENT_TYPE_TO_AIRTABLE.
 */

import type { NotificationEventType, NotificationPriority } from "@/types";

/** Event type constants for operational intelligence. */
export const NOTIFICATION_EVENT = {
  SHIFT_STARTED: "shift_started" as const,
  SHIFT_ENDED: "shift_ended" as const,
  SHIFT_LATE: "shift_late" as const,
  SHIFT_NO_SHOW: "shift_no_show" as const,
  SHIFT_OVERTIME: "shift_overtime" as const,
  SHIFT_RUNNING_LONG: "shift_running_long" as const,
  SHIFT_STARTING_SOON: "shift_starting_soon" as const,
  CHATTER_NO_MODELS: "chatter_no_models" as const,
  BREAK_STARTED: "break_started" as const,
  BREAK_ENDED: "break_ended" as const,
  BREAK_EXCEEDED: "break_exceeded" as const,
  BREAK_TOO_LONG: "break_too_long" as const,
  TASK_STARTED: "task_started" as const,
  TASK_FINISHED: "task_finished" as const,
  TASK_SHIFT_STARTED: "task_shift_started" as const,
  TASK_SHIFT_ENDED: "task_shift_ended" as const,
  TASK_COMPLETED: "task_completed" as const,
  TASK_OVERDUE: "task_overdue" as const,
  TASKS_NOT_STARTED: "tasks_not_started" as const,
  VA_TASK_REMINDER: "va_task_reminder" as const,
  MODEL_BECAME_FREE: "model_became_free" as const,
  MODEL_TAKEN: "model_taken" as const,
  MODEL_LIVE_STARTED: "model_live_started" as const,
  MODEL_LIVE_ENDED: "model_live_ended" as const,
  MODEL_LIVE_SCHEDULED: "model_live_scheduled" as const,
  MODEL_MISSED_LIVE: "model_missed_live" as const,
  MODEL_CONTENT_COMPLETED: "model_content_completed" as const,
  MODEL_CONTENT_SCHEDULED: "model_content_scheduled" as const,
  VA_CONTENT_ASSIGNED: "va_content_assigned" as const,
  PERIOD_3_DAY_REMINDER: "period_3_day_reminder" as const,
  PERIOD_PREDICTED_DAY: "period_predicted_day" as const,
  PERIOD_CONFIRMED_EARLY: "period_confirmed_early" as const,
  PERIOD_OVERDUE: "period_overdue" as const,
  PERIOD_PREDICTION_RESET: "period_prediction_reset" as const,
  WHALE_REGISTERED: "whale_registered" as const,
  WHALE_ASSIGNED: "whale_assigned" as const,
  WHALE_SPENT: "whale_spent" as const,
  CUSTOM_REQUEST_CREATED: "custom_request_created" as const,
  CUSTOM_REQUEST_UPDATED: "custom_request_updated" as const,
  CUSTOM_REQUEST_SUBMITTED: "custom_request_submitted" as const,
  CUSTOM_STATUS_CHANGED: "custom_status_changed" as const,
  CUSTOM_APPROVED: "custom_approved" as const,
  CUSTOM_REJECTED: "custom_rejected" as const,
  CUSTOM_DECLINED: "custom_declined" as const,
  CUSTOM_EDITED: "custom_edited" as const,
  CUSTOM_UPLOADED: "custom_uploaded" as const,
  CUSTOM_SCHEDULED: "custom_scheduled" as const,
  CUSTOM_DEADLINE_APPROACHING: "custom_deadline_approaching" as const,
  CUSTOM_OVERDUE: "custom_overdue" as const,
  FORM_SUBMITTED: "form_submitted" as const,
  SCHEDULE_UPDATED: "schedule_updated" as const,
  WEEKLY_AVAILABILITY_FRIDAY_REMINDER: "weekly_availability_friday_reminder" as const,
  AVAILABILITY_SUBMITTED: "availability_submitted" as const,
  SYSTEM_ALERT: "system_alert" as const,
  USER_CREATED: "user_created" as const,
  ROLE_CHANGED: "role_changed" as const,
  ACCOUNT_DELETED: "account_deleted" as const,
  DAILY_SUMMARY: "daily_summary" as const,
  POINTS_AWARDED: "points_awarded" as const,
  LEVEL_UP: "level_up" as const,
  SPIN_AVAILABLE: "spin_available" as const,
  CHALLENGE_COMPLETED: "challenge_completed" as const,
} satisfies Record<string, NotificationEventType>;

/** Default priority by event type for operational alerts. Callers can override. */
export const DEFAULT_PRIORITY_BY_EVENT: Partial<Record<NotificationEventType, NotificationPriority>> = {
  shift_overtime: "high",
  chatter_no_models: "high",
  shift_starting_soon: "high",
  weekly_availability_friday_reminder: "high",
  break_exceeded: "high",
  break_too_long: "high",
  model_missed_live: "critical",
  task_overdue: "high",
  tasks_not_started: "high",
  va_task_reminder: "high",
  custom_deadline_approaching: "high",
  custom_overdue: "critical",
  custom_approved: "normal",
  custom_rejected: "normal",
  custom_request_created: "high",
  custom_request_submitted: "high",
  /** Live start: higher default so assigned chatters are more likely to receive push (e.g. vs critical_only). */
  model_live_started: "high",
  model_live_ended: "normal",
  model_live_scheduled: "high",
  task_completed: "normal",
  model_content_completed: "normal",
  model_content_scheduled: "normal",
  va_content_assigned: "normal",
  period_3_day_reminder: "normal",
  period_predicted_day: "high",
  period_confirmed_early: "normal",
  period_overdue: "high",
  period_prediction_reset: "normal",
  form_submitted: "normal",
  availability_submitted: "normal",
  schedule_updated: "normal",
  user_created: "low",
  role_changed: "high",
  account_deleted: "critical",
  daily_summary: "normal",
  points_awarded: "normal",
  level_up: "high",
  spin_available: "normal",
  challenge_completed: "normal",
};

/** Entity types for notifications (entity_type in payload). */
export const NOTIFICATION_ENTITY = {
  SHIFT: "shift",
  TASK_SHIFT: "task_shift",
  VA_TASK: "va_task",
  WHALE: "whale",
  CUSTOM_REQUEST: "custom_request",
  PERIOD: "model_period",
  ACCOUNT: "account",
  CHATTER_MISTAKE: "chatter_mistake",
} as const;

/** Priorities. */
export const NOTIFICATION_PRIORITY = {
  LOW: "low" as NotificationPriority,
  NORMAL: "normal" as NotificationPriority,
  HIGH: "high" as NotificationPriority,
  CRITICAL: "critical" as NotificationPriority,
} as const;

/**
 * Payload shape for creating an in-app notification (and optional push).
 * Stored in notifications table; actor context and metadata for rich display.
 */
export type AdminNotificationPayload = {
  event_type: NotificationEventType;
  priority: NotificationPriority;
  title: string;
  body: string;
  entity_type: string;
  entity_id: string;
  actor_user_id?: string;
  actor_name?: string;
  /** Optional structured metadata (e.g. models, shift type, deadline). Stored when Airtable has metadata column. */
  metadata?: Array<{ label: string; value: string }>;
};
