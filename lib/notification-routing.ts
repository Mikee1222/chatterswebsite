/**
 * Role-based notification routing matrix.
 *
 * Recipient selection must depend on event type, role, operational relevance,
 * and current assignment. "All users" is rare, not default.
 *
 * When adding or changing notifications, update this matrix and ensure callers
 * use the correct recipient set (admin_only, admin_and_actor, assigned_user_only, etc.).
 */

import type { NotificationEventType } from "@/types";

/** Who receives the notification. Use these when implementing or auditing send paths. */
export type NotificationRecipientRule =
  | "admin_only"
  | "assigned_user_only"
  | "assigned_chatter_only"
  | "assigned_model_only"
  | "admin_and_actor"
  | "admin_and_assigned_chatter"
  | "assigned_party_only"
  | "all_users";

export type RoutingEntry = {
  rule: NotificationRecipientRule;
  description: string;
};

/**
 * Final routing rules by event type.
 * Callers must send only to the recipients implied by the rule (e.g. admin_only → notifyAdmins only).
 */
export const NOTIFICATION_ROUTING: Record<NotificationEventType, RoutingEntry> = {
  // ---- Shift ----
  shift_started: {
    rule: "admin_and_actor",
    description: "Admins + the chatter/VA who started the shift (operational user).",
  },
  shift_ended: {
    rule: "admin_and_actor",
    description: "Admins + the chatter/VA who ended the shift.",
  },
  shift_late: { rule: "admin_only", description: "Admins only (oversight)." },
  shift_no_show: { rule: "admin_only", description: "Admins only (oversight)." },
  shift_overtime: { rule: "admin_only", description: "Admins only." },
  shift_running_long: { rule: "admin_only", description: "Admins only." },
  shift_starting_soon: {
    rule: "assigned_user_only",
    description: "Scheduled chatter only (~30 min before weekly_program shift; cron).",
  },
  chatter_no_models: { rule: "admin_only", description: "Admins only (chatter on shift with no models)." },
  break_started: {
    rule: "admin_and_actor",
    description: "Admins + the chatter who started the break.",
  },
  break_ended: {
    rule: "admin_and_actor",
    description: "Admins + the chatter who ended the break.",
  },
  break_exceeded: { rule: "admin_only", description: "Admins only." },
  break_too_long: { rule: "admin_only", description: "Admins only." },

  // ---- Task shift ----
  task_shift_started: {
    rule: "admin_and_actor",
    description: "Admins + the VA who started the task shift.",
  },
  task_shift_ended: {
    rule: "admin_and_actor",
    description: "Admins + the VA who ended the task shift.",
  },
  task_started: { rule: "admin_and_actor", description: "Admins + assigned VA." },
  task_finished: { rule: "admin_and_actor", description: "Admins + assigned VA." },
  task_completed: { rule: "admin_and_actor", description: "Admins + assigned user." },
  task_overdue: { rule: "admin_only", description: "Admins only." },
  tasks_not_started: { rule: "admin_only", description: "Admins only." },
  va_task_reminder: {
    rule: "assigned_user_only",
    description: "The VA assigned to the task (reminder before due).",
  },

  // ---- Model (session / live) ----
  model_became_free: {
    rule: "assigned_user_only",
    description: "The chatter who left the model (confirmation only).",
  },
  model_taken: {
    rule: "assigned_user_only",
    description: "The chatter who entered the model (confirmation only).",
  },
  model_live_started: {
    rule: "admin_and_assigned_chatter",
    description: "Admins + the chatter who currently has that model on shift.",
  },
  model_live_ended: {
    rule: "admin_and_assigned_chatter",
    description: "Admins + the chatter who had that model on shift.",
  },
  model_live_scheduled: { rule: "admin_only", description: "Admins only." },
  model_missed_live: { rule: "admin_only", description: "Admins only." },
  model_content_completed: { rule: "admin_and_actor", description: "Admins + assigned party." },
  model_content_scheduled: {
    rule: "assigned_user_only",
    description: "Assigned VA when the model picks a date for VA-delivered content.",
  },
  va_content_assigned: {
    rule: "assigned_model_only",
    description: "The model user when a VA creates a content assignment for them.",
  },
  period_3_day_reminder: {
    rule: "assigned_model_only",
    description: "The linked model user (period tracking reminder ~3 days before expected start).",
  },
  period_predicted_day: {
    rule: "assigned_model_only",
    description: "The linked model user on predicted period start day (period tracking).",
  },
  period_confirmed_early: {
    rule: "assigned_model_only",
    description: "The linked model user when early period start is logged.",
  },
  period_overdue: {
    rule: "assigned_model_only",
    description: "The linked model user when expected period window needs logging (period tracking).",
  },
  period_prediction_reset: {
    rule: "assigned_model_only",
    description: "The linked model user when prediction is cleared or recalibrated.",
  },

  // ---- Whale ----
  whale_registered: {
    rule: "admin_and_actor",
    description: "Admins + the chatter who registered the whale (same dual path as shift_started).",
  },
  whale_assigned: { rule: "admin_only", description: "Admins only." },
  whale_followup: { rule: "admin_only", description: "Admins only." },
  whale_spent: { rule: "admin_only", description: "Admins only." },
  whale_session_submitted: {
    rule: "admin_only",
    description: "Admins only. Chatters/VAs do not receive whale session notifications.",
  },

  // ---- Custom request ----
  custom_request_created: { rule: "admin_only", description: "Admins only (new submission for review)." },
  custom_request_updated: { rule: "admin_only", description: "Admins only." },
  custom_request_submitted: { rule: "admin_only", description: "Admins only." },
  custom_status_changed: {
    rule: "assigned_party_only",
    description: "The chatter who requested the custom (status update from admin).",
  },
  custom_approved: { rule: "assigned_party_only", description: "Assigned party." },
  custom_rejected: { rule: "assigned_party_only", description: "Assigned party." },
  custom_declined: { rule: "assigned_chatter_only", description: "Chatter who requested the custom (agency decline)." },
  custom_edited: { rule: "assigned_party_only", description: "Chatter and/or model when agency edits terms." },
  custom_uploaded: { rule: "admin_and_assigned_chatter", description: "Chatter + admins when model uploads deliverables." },
  custom_scheduled: { rule: "admin_only", description: "Admins only (or assigned if needed)." },
  custom_deadline_approaching: { rule: "admin_only", description: "Admins only." },
  custom_overdue: { rule: "admin_only", description: "Admins only." },

  // ---- Forms / system ----
  form_submitted: { rule: "admin_only", description: "Admins only." },
  schedule_updated: { rule: "admin_only", description: "Admins only." },
  weekly_availability_friday_reminder: {
    rule: "assigned_user_only",
    description: "Active chatters/VAs missing next-week availability (Friday GMT+3 morning/evening cron).",
  },
  availability_submitted: { rule: "admin_only", description: "Admins only." },
  system_alert: { rule: "admin_only", description: "Admins only (or all_users if broadcast)." },
  account_update: { rule: "assigned_user_only", description: "The user whose account changed." },
  user_created: { rule: "admin_only", description: "Admins only." },
  role_changed: { rule: "admin_only", description: "Admins only." },
  account_deleted: { rule: "admin_only", description: "Admins only." },
  daily_summary: { rule: "admin_only", description: "Cron daily ops summary for admins." },

  // ---- Rewards ----
  points_awarded: {
    rule: "assigned_user_only",
    description: "The chatter who earned points.",
  },
  level_up: {
    rule: "assigned_user_only",
    description: "The chatter who reached a new rewards tier.",
  },
  spin_available: {
    rule: "assigned_user_only",
    description: "The chatter who earned a spin wheel credit.",
  },
  challenge_completed: {
    rule: "assigned_user_only",
    description: "The chatter who completed a live challenge.",
  },
};

/** Event types that must go only to admins (no chatters/VAs unless they are the actor for admin_and_actor). */
export const ADMIN_ONLY_EVENT_TYPES: NotificationEventType[] = [
  "whale_session_submitted",
  "whale_assigned",
  "whale_followup",
  "whale_spent",
  "custom_request_created",
  "custom_request_updated",
  "custom_request_submitted",
  "custom_scheduled",
  "custom_deadline_approaching",
  "custom_overdue",
  "form_submitted",
  "schedule_updated",
  "availability_submitted",
  "shift_late",
  "shift_no_show",
  "shift_overtime",
  "shift_running_long",
  "chatter_no_models",
  "break_exceeded",
  "break_too_long",
  "task_overdue",
  "tasks_not_started",
  "model_live_scheduled",
  "model_missed_live",
  "system_alert",
  "user_created",
  "role_changed",
  "account_deleted",
  "daily_summary",
];

/** Event types that go only to the assigned/acting user (no admins unless also admin_and_actor). */
export const ASSIGNED_USER_ONLY_EVENT_TYPES: NotificationEventType[] = [
  "model_became_free",
  "model_taken",
  "account_update",
  "shift_starting_soon",
  "weekly_availability_friday_reminder",
  "va_task_reminder",
  "points_awarded",
  "level_up",
  "spin_available",
  "challenge_completed",
  "model_content_scheduled",
  "va_content_assigned",
];
