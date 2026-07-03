/**
 * Role-based notification routing matrix.
 *
 * Recipient selection depends on event type, role, operational relevance,
 * and current assignment. Rules align with per-role notification scope (personal /
 * broadcast / none) defined in lib/notification-role-defaults.ts.
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
  | "admin_and_assigned_party"
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
  // ---- Shift (monitoring except personal reminders) ----
  shift_started: {
    rule: "admin_only",
    description: "Admins/managers monitor when a chatter/VA starts a shift.",
  },
  shift_ended: {
    rule: "admin_only",
    description: "Admins/managers monitor when a chatter/VA ends a shift.",
  },
  shift_late: {
    rule: "assigned_chatter_only",
    description: "The scheduled chatter who was late.",
  },
  shift_no_show: { rule: "admin_only", description: "Admins only (oversight)." },
  shift_overtime: { rule: "admin_only", description: "Admins only." },
  shift_running_long: { rule: "admin_only", description: "Admins only." },
  shift_starting_soon: {
    rule: "assigned_user_only",
    description: "Scheduled chatter/VA only (~30 min before shift; cron).",
  },
  chatter_no_models: { rule: "admin_only", description: "Admins only (chatter on shift with no models)." },
  break_started: {
    rule: "admin_only",
    description: "Admins monitor break start.",
  },
  break_ended: {
    rule: "admin_only",
    description: "Admins monitor break end.",
  },
  break_exceeded: {
    rule: "assigned_chatter_only",
    description: "The chatter whose break exceeded 45 minutes.",
  },
  break_too_long: {
    rule: "assigned_chatter_only",
    description: "The chatter whose break duration limit was exceeded.",
  },

  // ---- Task shift ----
  task_shift_started: {
    rule: "admin_only",
    description: "Admins monitor VA task shift start.",
  },
  task_shift_ended: {
    rule: "admin_only",
    description: "Admins monitor VA task shift end.",
  },
  task_started: { rule: "admin_only", description: "Admins monitor VA task start." },
  task_finished: { rule: "admin_only", description: "Admins monitor VA task end." },
  task_completed: {
    rule: "assigned_user_only",
    description: "Assigned VA when a task is completed.",
  },
  task_overdue: {
    rule: "assigned_user_only",
    description: "Assigned VA reminded when a task is overdue.",
  },
  tasks_not_started: { rule: "admin_only", description: "Admins only." },
  va_task_reminder: {
    rule: "assigned_user_only",
    description: "The VA assigned to the task (reminder before due).",
  },
  phase_task_completed: { rule: "admin_only", description: "Admins only (VA checklist progress)." },
  phase_completed: {
    rule: "assigned_user_only",
    description: "Assigned VA when a phase is completed.",
  },
  phase_overdue: {
    rule: "assigned_user_only",
    description: "Assigned VA when a phase is overdue.",
  },
  all_phases_completed: {
    rule: "assigned_user_only",
    description: "Assigned VA when all phases are done.",
  },

  // ---- Model (session / live) ----
  model_became_free: {
    rule: "assigned_chatter_only",
    description: "Assigned chatter when a model becomes available.",
  },
  model_taken: {
    rule: "assigned_party_only",
    description: "Chatter and model when a model session starts.",
  },
  model_live_started: {
    rule: "assigned_party_only",
    description: "Assigned chatters and model when live starts.",
  },
  model_live_ended: {
    rule: "assigned_party_only",
    description: "Assigned chatters and model when live ends.",
  },
  model_live_scheduled: {
    rule: "assigned_model_only",
    description: "The model user for upcoming live stream reminder.",
  },
  model_missed_live: {
    rule: "assigned_model_only",
    description: "The model user when a scheduled live is missed.",
  },
  model_content_completed: {
    rule: "assigned_party_only",
    description: "Assigned model/VA when model content is completed.",
  },
  model_content_scheduled: {
    rule: "assigned_party_only",
    description: "Assigned model/VA when content is scheduled.",
  },
  va_content_assigned: {
    rule: "assigned_user_only",
    description: "Assigned VA when they receive a content assignment.",
  },
  va_task_assigned: {
    rule: "assigned_user_only",
    description: "Assigned VA when a new VA task is created for them.",
  },
  model_content_request_created: {
    rule: "admin_only",
    description: "Admins/managers when a model files a content request.",
  },
  model_content_request_reviewed: {
    rule: "assigned_model_only",
    description: "The filing model when their content request status changes.",
  },
  va_content_scheduled: {
    rule: "assigned_model_only",
    description: "The model user when content delivery is scheduled.",
  },
  va_content_completed: {
    rule: "assigned_model_only",
    description: "The model user when content is marked complete.",
  },
  period_3_day_reminder: {
    rule: "assigned_model_only",
    description: "The linked model user (period tracking reminder ~3 days before expected start).",
  },
  period_predicted_day: {
    rule: "assigned_model_only",
    description: "The linked model user on predicted period start day.",
  },
  period_confirmed_early: {
    rule: "assigned_model_only",
    description: "The linked model user when early period start is logged.",
  },
  period_overdue: {
    rule: "assigned_model_only",
    description: "The linked model user when expected period window needs logging.",
  },
  period_prediction_reset: {
    rule: "assigned_model_only",
    description: "The linked model user when prediction is cleared or recalibrated.",
  },

  // ---- Whale ----
  whale_registered: {
    rule: "admin_and_actor",
    description: "Chatter who registered receives confirmation; admins monitor.",
  },
  whale_assigned: {
    rule: "assigned_chatter_only",
    description: "The chatter assigned to the whale.",
  },
  whale_followup: {
    rule: "assigned_chatter_only",
    description: "The assigned chatter when whale follow-up is due.",
  },
  whale_spent: {
    rule: "admin_and_actor",
    description: "Chatter who logged spending receives confirmation; admins monitor.",
  },
  whale_session_submitted: {
    rule: "admin_and_actor",
    description: "Chatter who submitted the session receives confirmation; admins monitor.",
  },

  // ---- Custom request (personal — assigned party only) ----
  custom_request_created: {
    rule: "assigned_party_only",
    description: "Requesting party when a custom request is created.",
  },
  custom_request_updated: {
    rule: "assigned_party_only",
    description: "Assigned party when custom details are updated.",
  },
  custom_request_submitted: {
    rule: "assigned_party_only",
    description: "Assigned party when custom is submitted to agency.",
  },
  custom_status_changed: {
    rule: "assigned_party_only",
    description: "The chatter who requested the custom.",
  },
  custom_approved: {
    rule: "assigned_party_only",
    description: "Assigned party when custom is approved.",
  },
  custom_rejected: {
    rule: "assigned_party_only",
    description: "Assigned party when custom is rejected.",
  },
  custom_declined: {
    rule: "assigned_party_only",
    description: "Chatter who requested the custom (agency decline).",
  },
  custom_edited: {
    rule: "assigned_party_only",
    description: "Chatter/model when agency edits terms.",
  },
  custom_uploaded: {
    rule: "assigned_party_only",
    description: "Assigned party when custom content is uploaded.",
  },
  custom_request_uploaded: {
    rule: "assigned_party_only",
    description: "Assigned VA when custom request file is uploaded.",
  },
  custom_scheduled: {
    rule: "assigned_party_only",
    description: "Assigned party when custom delivery is scheduled.",
  },
  custom_deadline_approaching: {
    rule: "assigned_party_only",
    description: "Requesting party for 48h deadline window.",
  },
  custom_overdue: {
    rule: "assigned_party_only",
    description: "Assigned party when custom is past deadline.",
  },

  // ---- Forms / system ----
  form_submitted: { rule: "admin_only", description: "Admins only." },
  schedule_updated: {
    rule: "assigned_user_only",
    description: "Chatters/VAs when weekly schedule is updated.",
  },
  weekly_availability_friday_reminder: {
    rule: "assigned_user_only",
    description: "Active chatters/VAs missing next-week availability (Friday cron).",
  },
  availability_submitted: { rule: "admin_only", description: "Admins only." },
  system_alert: {
    rule: "admin_only",
    description: "Admins only (general system message).",
  },
  account_update: {
    rule: "assigned_user_only",
    description: "The user whose account changed.",
  },
  user_created: { rule: "admin_only", description: "Admins only." },
  role_changed: {
    rule: "assigned_user_only",
    description: "The user whose role changed.",
  },
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
  spin_result: {
    rule: "assigned_party_only",
    description: "Chatter/VA notified of spin wheel prize.",
  },
  billing_cycle_announced: {
    rule: "assigned_user_only",
    description: "The B2B client when a billing cycle is announced.",
  },
  billing_due_reminder: {
    rule: "assigned_user_only",
    description: "The B2B client two days before payment due date.",
  },
  billing_payment_submitted: {
    rule: "admin_only",
    description: "Admins when a client submits payment proof.",
  },
  payment_submitted: {
    rule: "admin_and_actor",
    description: "Client receives confirmation; admins monitor payment proof.",
  },
  payment_confirmed: {
    rule: "assigned_user_only",
    description: "The B2B client when payment proof is approved.",
  },
  payment_rejected: {
    rule: "assigned_user_only",
    description: "The B2B client when payment proof is rejected.",
  },
  sop_academy_reminder: {
    rule: "assigned_user_only",
    description: "Learner reminded to continue SOP Academy training.",
  },
  sop_academy_training_complete: {
    rule: "assigned_user_only",
    description: "Learner when academy training is complete.",
  },
  sop_academy_signed_off: {
    rule: "assigned_user_only",
    description: "Learner when academy training is signed off.",
  },
  expense_approved: {
    rule: "admin_and_assigned_party",
    description: "Admins + linked model when an expense request is approved.",
  },
  expense_rejected: {
    rule: "admin_and_assigned_party",
    description: "Admins + linked model when an expense request is rejected.",
  },
  chatter_mistake: {
    rule: "assigned_chatter_only",
    description: "The chatter who received the mistake.",
  },
  chatter_mistake_reviewed: {
    rule: "assigned_party_only",
    description: "Chatter or VA when a mistake report is approved or rejected.",
  },
  fine_issued: {
    rule: "assigned_party_only",
    description: "Chatter/VA notified when fine is issued",
  },
  bonus_awarded: {
    rule: "assigned_party_only",
    description: "Chatter/VA notified when bonus is awarded",
  },
  fine_bonus_reviewed: {
    rule: "assigned_party_only",
    description: "Chatter/VA notified when fine/bonus is reviewed",
  },
  shadowban_report: {
    rule: "assigned_party_only",
    description: "VA or model linked to the shadowban report (legacy).",
  },
  shadowban_submitted: {
    rule: "assigned_party_only",
    description: "VA or model when a shadowban report is filed.",
  },
  shadowban_resolved: {
    rule: "assigned_party_only",
    description: "Reporter when a shadowban report is approved or dismissed.",
  },
  sop_quiz_passed: {
    rule: "assigned_party_only",
    description: "Chatter/VA when they pass an SOP quiz.",
  },
  sop_quiz_failed: {
    rule: "assigned_party_only",
    description: "Chatter/VA when they fail an SOP quiz.",
  },
  schedule_published: {
    rule: "assigned_party_only",
    description: "Chatter/VA when the weekly schedule is published.",
  },
  login_new_device: {
    rule: "assigned_party_only",
    description: "User notified when logging in from a new device.",
  },
  password_changed: {
    rule: "assigned_party_only",
    description: "User notified when their password is changed.",
  },

  // ---- Admin monitoring variants (_admin suffix) ----
  shift_started_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  shift_ended_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  shift_late_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  shift_no_show_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  shift_overtime_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  shift_running_long_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  chatter_no_models_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  break_started_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  break_ended_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  break_exceeded_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  break_too_long_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  task_started_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  task_finished_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  task_shift_started_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  task_shift_ended_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  task_completed_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  task_overdue_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  tasks_not_started_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  phase_task_completed_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  phase_completed_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  phase_overdue_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  all_phases_completed_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  model_became_free_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  model_taken_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  model_live_started_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  model_live_ended_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  model_missed_live_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  model_content_completed_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  model_content_scheduled_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  va_content_assigned_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  va_content_scheduled_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  va_content_completed_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  custom_request_uploaded_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  whale_registered_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  whale_assigned_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  whale_followup_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  whale_spent_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  whale_session_submitted_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  custom_request_created_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  custom_request_updated_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  custom_request_submitted_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  custom_status_changed_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  custom_approved_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  custom_rejected_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  custom_declined_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  custom_edited_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  custom_uploaded_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  custom_scheduled_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  custom_deadline_approaching_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  custom_overdue_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  form_submitted_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  schedule_updated_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  availability_submitted_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  user_created_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  points_awarded_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  level_up_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  challenge_completed_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  spin_result_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  sop_academy_training_complete_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  sop_academy_signed_off_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  payment_submitted_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  billing_payment_submitted_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  expense_approved_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  expense_rejected_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  chatter_mistake_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  chatter_mistake_reviewed_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  fine_issued_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  bonus_awarded_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  fine_bonus_reviewed_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  shadowban_report_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  shadowban_submitted_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  shadowban_resolved_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  period_overdue_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  billing_cycle_announced_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  sop_quiz_passed_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
  schedule_published_admin: { rule: "admin_only", description: "Admin/manager monitoring notification." },
};

/**
 * Subset of events where **typical** paths are admin-only.
 * Always prefer `NOTIFICATION_ROUTING` per event when auditing.
 */
export const ADMIN_ONLY_EVENT_TYPES: NotificationEventType[] = [
  "shift_started",
  "shift_ended",
  "shift_no_show",
  "shift_overtime",
  "shift_running_long",
  "chatter_no_models",
  "break_started",
  "break_ended",
  "task_started",
  "task_finished",
  "task_shift_started",
  "task_shift_ended",
  "tasks_not_started",
  "phase_task_completed",
  "model_became_free",
  "model_taken",
  "model_live_started",
  "model_live_ended",
  "model_missed_live",
  "whale_registered",
  "whale_spent",
  "whale_session_submitted",
  "availability_submitted",
  "form_submitted",
  "user_created",
  "account_deleted",
  "daily_summary",
  "system_alert",
  "payment_submitted",
  "billing_payment_submitted",
  "model_content_request_created",
];

/** Event types that go only to the assigned/acting user (no admins). */
export const ASSIGNED_USER_ONLY_EVENT_TYPES: NotificationEventType[] = [
  "shift_starting_soon",
  "shift_late",
  "shift_no_show",
  "shift_overtime",
  "shift_running_long",
  "chatter_no_models",
  "model_became_free",
  "model_live_started",
  "break_exceeded",
  "break_too_long",
  "account_update",
  "role_changed",
  "weekly_availability_friday_reminder",
  "va_task_reminder",
  "va_content_scheduled",
  "va_task_assigned",
  "task_completed",
  "task_overdue",
  "phase_completed",
  "phase_overdue",
  "all_phases_completed",
  "model_content_scheduled",
  "model_content_completed",
  "va_content_completed",
  "custom_request_created",
  "custom_request_updated",
  "custom_request_submitted",
  "custom_status_changed",
  "custom_approved",
  "custom_rejected",
  "custom_declined",
  "custom_edited",
  "custom_uploaded",
  "custom_request_uploaded",
  "custom_scheduled",
  "custom_deadline_approaching",
  "custom_overdue",
  "sop_academy_training_complete",
  "sop_academy_signed_off",
  "shadowban_report",
  "points_awarded",
  "level_up",
  "spin_available",
  "challenge_completed",
  "va_content_assigned",
  "model_live_scheduled",
  "period_3_day_reminder",
  "period_predicted_day",
  "period_confirmed_early",
  "period_overdue",
  "period_prediction_reset",
  "billing_cycle_announced",
  "billing_due_reminder",
  "payment_confirmed",
  "payment_rejected",
  "sop_academy_reminder",
  "schedule_updated",
  "whale_registered",
  "whale_assigned",
  "whale_spent",
  "whale_followup",
  "whale_session_submitted",
  "chatter_mistake",
  "chatter_mistake_reviewed",
  "fine_issued",
  "bonus_awarded",
  "fine_bonus_reviewed",
  "shadowban_submitted",
  "shadowban_resolved",
  "sop_quiz_passed",
  "sop_quiz_failed",
  "schedule_published",
  "login_new_device",
  "password_changed",
];
