import type { NotificationEventType, UserRole } from "@/types";

/** Which role’s recipient dropdown a preset row uses in the admin test UI. */
export type NotificationTestGroup = "chatter" | "virtual_assistant" | "model" | "admin";

export type NotificationTestPreset = {
  /** Stable id for React keys / script labels */
  id: string;
  /** UI section */
  group: NotificationTestGroup;
  event_type: NotificationEventType;
  title: string;
  body: string;
  entity_type: string;
};

export function buildDebugTestEntityId(presetId: string): string {
  return `debug_test:${presetId}:${Date.now()}`;
}

/**
 * Manual test payloads for every `NotificationEventType` (plus sensible `entity_type`).
 * Recipients are chosen in the UI per role; these are content templates only.
 */
export const NOTIFICATION_TEST_PRESETS: NotificationTestPreset[] = [
  // —— Chatter / shift ——
  {
    id: "shift_started",
    group: "chatter",
    event_type: "shift_started",
    title: "TEST: Shift started",
    body: "Your shift has started (debug).",
    entity_type: "shift",
  },
  {
    id: "shift_ended",
    group: "chatter",
    event_type: "shift_ended",
    title: "TEST: Shift ended",
    body: "Your shift has ended (debug).",
    entity_type: "shift",
  },
  {
    id: "shift_late",
    group: "chatter",
    event_type: "shift_late",
    title: "TEST: Shift late",
    body: "You are late for your shift (debug).",
    entity_type: "shift",
  },
  {
    id: "shift_no_show",
    group: "admin",
    event_type: "shift_no_show",
    title: "TEST: Shift no-show",
    body: "No-show alert (debug).",
    entity_type: "shift",
  },
  {
    id: "shift_overtime",
    group: "admin",
    event_type: "shift_overtime",
    title: "TEST: Shift overtime",
    body: "Oversight: shift overtime (debug).",
    entity_type: "shift",
  },
  {
    id: "shift_running_long",
    group: "admin",
    event_type: "shift_running_long",
    title: "TEST: Shift running long",
    body: "Oversight: shift running long (debug).",
    entity_type: "shift",
  },
  {
    id: "shift_starting_soon",
    group: "chatter",
    event_type: "shift_starting_soon",
    title: "TEST: Shift starting soon",
    body: "Your shift starts in ~30 minutes (debug).",
    entity_type: "shift",
  },
  {
    id: "chatter_no_models",
    group: "admin",
    event_type: "chatter_no_models",
    title: "TEST: Chatter on shift, no models",
    body: "Chatter has no models attached (debug).",
    entity_type: "shift",
  },
  {
    id: "break_started",
    group: "chatter",
    event_type: "break_started",
    title: "TEST: Break started",
    body: "Break started (debug).",
    entity_type: "shift",
  },
  {
    id: "break_ended",
    group: "chatter",
    event_type: "break_ended",
    title: "TEST: Break ended",
    body: "Break ended (debug).",
    entity_type: "shift",
  },
  {
    id: "break_exceeded",
    group: "chatter",
    event_type: "break_exceeded",
    title: "TEST: Break exceeded",
    body: "Break over 45 minutes (debug).",
    entity_type: "shift",
  },
  {
    id: "break_too_long",
    group: "admin",
    event_type: "break_too_long",
    title: "TEST: Break too long",
    body: "Admin: break too long (debug).",
    entity_type: "shift",
  },
  // —— Model on shift ——
  {
    id: "model_taken",
    group: "chatter",
    event_type: "model_taken",
    title: "TEST: Model taken",
    body: "You added a model to your shift (debug).",
    entity_type: "model",
  },
  {
    id: "model_became_free",
    group: "chatter",
    event_type: "model_became_free",
    title: "TEST: Model became free",
    body: "A model left your shift (debug).",
    entity_type: "model",
  },
  {
    id: "model_live_started",
    group: "chatter",
    event_type: "model_live_started",
    title: "TEST: Model live started",
    body: "Model went live (debug).",
    entity_type: "model_live_stream",
  },
  {
    id: "model_live_ended",
    group: "chatter",
    event_type: "model_live_ended",
    title: "TEST: Model live ended",
    body: "Model live ended (debug).",
    entity_type: "model_live_stream",
  },
  {
    id: "model_live_scheduled",
    group: "model",
    event_type: "model_live_scheduled",
    title: "TEST: Live starting soon",
    body: "Scheduled live reminder (debug).",
    entity_type: "model_live_stream",
  },
  {
    id: "model_missed_live",
    group: "admin",
    event_type: "model_missed_live",
    title: "TEST: Missed live",
    body: "Model missed scheduled live (debug).",
    entity_type: "model_live_stream",
  },
  // —— Whale ——
  {
    id: "whale_registered",
    group: "chatter",
    event_type: "whale_registered",
    title: "TEST: Whale registered",
    body: "Whale submitted (debug).",
    entity_type: "whale",
  },
  {
    id: "whale_assigned",
    group: "chatter",
    event_type: "whale_assigned",
    title: "TEST: Whale assigned",
    body: "Whale assigned to you (debug).",
    entity_type: "whale",
  },
  {
    id: "whale_followup",
    group: "admin",
    event_type: "whale_followup",
    title: "TEST: Whale follow-up",
    body: "Whale follow-up (debug).",
    entity_type: "whale",
  },
  {
    id: "whale_spent",
    group: "admin",
    event_type: "whale_spent",
    title: "TEST: Whale spent",
    body: "Whale spend alert (debug).",
    entity_type: "whale",
  },
  {
    id: "whale_session_submitted",
    group: "admin",
    event_type: "whale_session_submitted",
    title: "TEST: Whale session submitted",
    body: "Chatter logged a session (debug).",
    entity_type: "whale",
  },
  // —— Custom ——
  {
    id: "custom_request_created",
    group: "virtual_assistant",
    event_type: "custom_request_created",
    title: "TEST: Custom request created",
    body: "New custom in queue (debug).",
    entity_type: "custom_request",
  },
  {
    id: "custom_request_updated",
    group: "admin",
    event_type: "custom_request_updated",
    title: "TEST: Custom request updated",
    body: "Custom updated (debug).",
    entity_type: "custom_request",
  },
  {
    id: "custom_request_submitted",
    group: "admin",
    event_type: "custom_request_submitted",
    title: "TEST: Custom submitted",
    body: "Custom submitted (debug).",
    entity_type: "custom_request",
  },
  {
    id: "custom_status_changed",
    group: "chatter",
    event_type: "custom_status_changed",
    title: "TEST: Custom status changed",
    body: "Admin changed custom status (debug).",
    entity_type: "custom_request",
  },
  {
    id: "custom_approved",
    group: "model",
    event_type: "custom_approved",
    title: "TEST: Custom approved",
    body: "Custom approved (debug).",
    entity_type: "custom_request",
  },
  {
    id: "custom_rejected",
    group: "chatter",
    event_type: "custom_rejected",
    title: "TEST: Custom rejected",
    body: "Custom rejected (debug).",
    entity_type: "custom_request",
  },
  {
    id: "custom_declined",
    group: "chatter",
    event_type: "custom_declined",
    title: "TEST: Custom declined",
    body: "Agency declined custom (debug).",
    entity_type: "custom_request",
  },
  {
    id: "custom_edited",
    group: "chatter",
    event_type: "custom_edited",
    title: "TEST: Custom edited",
    body: "Custom terms edited (debug).",
    entity_type: "custom_request",
  },
  {
    id: "custom_uploaded",
    group: "chatter",
    event_type: "custom_uploaded",
    title: "TEST: Custom uploaded",
    body: "Model uploaded deliverables (debug).",
    entity_type: "custom_request",
  },
  {
    id: "custom_scheduled",
    group: "model",
    event_type: "custom_scheduled",
    title: "TEST: Custom scheduled",
    body: "Custom scheduled (debug).",
    entity_type: "custom_request",
  },
  {
    id: "custom_deadline_approaching",
    group: "chatter",
    event_type: "custom_deadline_approaching",
    title: "TEST: Custom deadline approaching",
    body: "Due within 48h (debug).",
    entity_type: "custom_request",
  },
  {
    id: "custom_overdue",
    group: "admin",
    event_type: "custom_overdue",
    title: "TEST: Custom overdue",
    body: "Custom stale / overdue (debug).",
    entity_type: "custom_request",
  },
  // —— VA / tasks ——
  {
    id: "task_started",
    group: "virtual_assistant",
    event_type: "task_started",
    title: "TEST: Task started",
    body: "Task shift started (debug).",
    entity_type: "task_shift",
  },
  {
    id: "task_finished",
    group: "virtual_assistant",
    event_type: "task_finished",
    title: "TEST: Task finished",
    body: "Task shift finished (debug).",
    entity_type: "task_shift",
  },
  {
    id: "task_shift_started",
    group: "virtual_assistant",
    event_type: "task_shift_started",
    title: "TEST: Task shift started (typed)",
    body: "task_shift_started (debug).",
    entity_type: "task_shift",
  },
  {
    id: "task_shift_ended",
    group: "virtual_assistant",
    event_type: "task_shift_ended",
    title: "TEST: Task shift ended (typed)",
    body: "task_shift_ended (debug).",
    entity_type: "task_shift",
  },
  {
    id: "task_completed",
    group: "virtual_assistant",
    event_type: "task_completed",
    title: "TEST: Task completed",
    body: "VA task completed (debug).",
    entity_type: "va_task",
  },
  {
    id: "task_overdue",
    group: "admin",
    event_type: "task_overdue",
    title: "TEST: Task overdue",
    body: "Task overdue (debug).",
    entity_type: "va_task",
  },
  {
    id: "tasks_not_started",
    group: "admin",
    event_type: "tasks_not_started",
    title: "TEST: Tasks not started",
    body: "Tasks not started (debug).",
    entity_type: "va_task",
  },
  {
    id: "va_task_reminder",
    group: "virtual_assistant",
    event_type: "va_task_reminder",
    title: "TEST: VA task reminder",
    body: "Task due soon (debug).",
    entity_type: "va_task",
  },
  {
    id: "phase_task_completed",
    group: "admin",
    event_type: "phase_task_completed",
    title: "TEST: Phase item completed",
    body: "VA finished a checklist item (debug).",
    entity_type: "va_task_phase_item",
  },
  {
    id: "phase_completed",
    group: "admin",
    event_type: "phase_completed",
    title: "TEST: Phase completed",
    body: "All items in a phase done (debug).",
    entity_type: "va_task_phase",
  },
  {
    id: "phase_overdue",
    group: "admin",
    event_type: "phase_overdue",
    title: "TEST: Phase overdue",
    body: "Scheduled phase missed (debug).",
    entity_type: "va_task_phase",
  },
  {
    id: "all_phases_completed",
    group: "admin",
    event_type: "all_phases_completed",
    title: "TEST: All phases completed",
    body: "Every phase for the task is done (debug).",
    entity_type: "va_task",
  },
  {
    id: "model_content_scheduled",
    group: "virtual_assistant",
    event_type: "model_content_scheduled",
    title: "TEST: Model content scheduled",
    body: "Model scheduled content (debug).",
    entity_type: "va_content_assignment",
  },
  {
    id: "model_content_completed",
    group: "virtual_assistant",
    event_type: "model_content_completed",
    title: "TEST: Model content completed",
    body: "Model completed content (debug).",
    entity_type: "va_content_assignment",
  },
  {
    id: "va_content_assigned",
    group: "model",
    event_type: "va_content_assigned",
    title: "TEST: VA content assigned",
    body: "New VA content assignment (debug).",
    entity_type: "va_content_assignment",
  },
  // —— Period ——
  {
    id: "period_3_day_reminder",
    group: "model",
    event_type: "period_3_day_reminder",
    title: "TEST: Period 3-day reminder",
    body: "Cycle reminder (debug).",
    entity_type: "model_period",
  },
  {
    id: "period_predicted_day",
    group: "model",
    event_type: "period_predicted_day",
    title: "TEST: Period predicted day",
    body: "Predicted period day (debug).",
    entity_type: "model_period",
  },
  {
    id: "period_confirmed_early",
    group: "model",
    event_type: "period_confirmed_early",
    title: "TEST: Period confirmed early",
    body: "Early confirmation (debug).",
    entity_type: "model_period",
  },
  {
    id: "period_overdue",
    group: "model",
    event_type: "period_overdue",
    title: "TEST: Period overdue",
    body: "Period overdue (debug).",
    entity_type: "model_period",
  },
  {
    id: "period_prediction_reset",
    group: "model",
    event_type: "period_prediction_reset",
    title: "TEST: Period prediction reset",
    body: "Prediction reset (debug).",
    entity_type: "model_period",
  },
  // —— Forms / schedule / system ——
  {
    id: "form_submitted",
    group: "admin",
    event_type: "form_submitted",
    title: "TEST: Form submitted",
    body: "Form submitted (debug).",
    entity_type: "form",
  },
  {
    id: "schedule_updated",
    group: "chatter",
    event_type: "schedule_updated",
    title: "TEST: Schedule updated",
    body: "Weekly program published (debug).",
    entity_type: "system",
  },
  {
    id: "weekly_availability_friday_reminder",
    group: "chatter",
    event_type: "weekly_availability_friday_reminder",
    title: "TEST: Friday availability reminder",
    body: "Submit availability (debug).",
    entity_type: "system",
  },
  {
    id: "availability_submitted",
    group: "chatter",
    event_type: "availability_submitted",
    title: "TEST: Availability submitted",
    body: "Availability recorded (debug).",
    entity_type: "system",
  },
  {
    id: "system_alert",
    group: "admin",
    event_type: "system_alert",
    title: "TEST: System alert",
    body: "Generic system alert (debug).",
    entity_type: "system",
  },
  {
    id: "account_update",
    group: "chatter",
    event_type: "account_update",
    title: "TEST: Account update",
    body: "Your account was updated (debug).",
    entity_type: "account",
  },
  {
    id: "user_created",
    group: "admin",
    event_type: "user_created",
    title: "TEST: User created",
    body: "New user created (debug).",
    entity_type: "account",
  },
  {
    id: "role_changed",
    group: "admin",
    event_type: "role_changed",
    title: "TEST: Role changed",
    body: "User role changed (debug).",
    entity_type: "account",
  },
  {
    id: "account_deleted",
    group: "admin",
    event_type: "account_deleted",
    title: "TEST: Account deleted",
    body: "Account deleted (debug).",
    entity_type: "account",
  },
  {
    id: "daily_summary",
    group: "admin",
    event_type: "daily_summary",
    title: "TEST: Daily summary",
    body: "Daily ops summary (debug).",
    entity_type: "system",
  },
  // —— Rewards ——
  {
    id: "points_awarded",
    group: "chatter",
    event_type: "points_awarded",
    title: "TEST: Points awarded",
    body: "+50 pts (debug).",
    entity_type: "points_transaction",
  },
  {
    id: "level_up",
    group: "chatter",
    event_type: "level_up",
    title: "TEST: Level up",
    body: "You reached Gold (debug).",
    entity_type: "chatter_points",
  },
  {
    id: "spin_available",
    group: "chatter",
    event_type: "spin_available",
    title: "TEST: Spin available",
    body: "Free spin available (debug).",
    entity_type: "chatter_points",
  },
  {
    id: "challenge_completed",
    group: "chatter",
    event_type: "challenge_completed",
    title: "TEST: Challenge completed",
    body: "Challenge done (debug).",
    entity_type: "challenge",
  },
];

export function presetsForGroup(group: NotificationTestGroup): NotificationTestPreset[] {
  return NOTIFICATION_TEST_PRESETS.filter((p) => p.group === group);
}

export function isNotificationTestingEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ENABLE_NOTIFICATION_TESTING === "true";
}

/** Serialized user row for the test UI (no secrets). */
export type NotificationTestUserOption = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  status: string;
};
