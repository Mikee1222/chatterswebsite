/**
 * Base event types that have a paired `_admin` monitoring variant.
 * Personal events go to assigned/target roles; `_admin` events broadcast to admin/manager.
 */

import type { NotificationEventType, UserRole } from "@/types";

export const NOTIFICATION_EVENTS_WITH_ADMIN_VARIANT = [
  "shift_started",
  "shift_ended",
  "shift_late",
  "shift_no_show",
  "shift_overtime",
  "shift_running_long",
  "chatter_no_models",
  "break_started",
  "break_ended",
  "break_exceeded",
  "break_too_long",
  "task_started",
  "task_finished",
  "task_shift_started",
  "task_shift_ended",
  "task_completed",
  "task_overdue",
  "tasks_not_started",
  "phase_task_completed",
  "phase_completed",
  "phase_overdue",
  "all_phases_completed",
  "model_became_free",
  "model_taken",
  "model_live_started",
  "model_live_ended",
  "model_missed_live",
  "model_content_completed",
  "model_content_scheduled",
  "va_content_assigned",
  "va_content_scheduled",
  "va_content_completed",
  "custom_request_uploaded",
  "whale_registered",
  "whale_assigned",
  "whale_followup",
  "whale_spent",
  "whale_session_submitted",
  "custom_request_created",
  "custom_request_updated",
  "custom_request_submitted",
  "custom_status_changed",
  "custom_approved",
  "custom_rejected",
  "custom_declined",
  "custom_edited",
  "custom_uploaded",
  "custom_scheduled",
  "custom_deadline_approaching",
  "custom_overdue",
  "form_submitted",
  "schedule_updated",
  "availability_submitted",
  "user_created",
  "points_awarded",
  "level_up",
  "challenge_completed",
  "spin_result",
  "sop_academy_training_complete",
  "sop_academy_signed_off",
  "payment_submitted",
  "billing_payment_submitted",
  "expense_approved",
  "expense_rejected",
  "chatter_mistake",
  "chatter_mistake_reviewed",
  "fine_issued",
  "bonus_awarded",
  "fine_bonus_reviewed",
  "shadowban_report",
  "shadowban_submitted",
  "shadowban_resolved",
  "period_overdue",
  "billing_cycle_announced",
  "sop_quiz_passed",
  "schedule_published",
] as const satisfies readonly NotificationEventType[];

export type NotificationEventWithAdminVariant =
  (typeof NOTIFICATION_EVENTS_WITH_ADMIN_VARIANT)[number];

export type NotificationAdminEventType = `${NotificationEventWithAdminVariant}_admin`;

export function hasAdminVariant(eventType: string): eventType is NotificationEventWithAdminVariant {
  return (NOTIFICATION_EVENTS_WITH_ADMIN_VARIANT as readonly string[]).includes(eventType);
}

export function toAdminEventType(
  base: NotificationEventWithAdminVariant
): NotificationAdminEventType {
  return `${base}_admin`;
}

/** Actor roles that receive the personal (non-admin) variant for monitoring-style events. */
export const MONITORING_ACTOR_ROLES: Partial<
  Record<NotificationEventWithAdminVariant, readonly UserRole[]>
> = {
  shift_started: ["chatter", "virtual_assistant"],
  shift_ended: ["chatter", "virtual_assistant"],
  break_started: ["chatter"],
  break_ended: ["chatter"],
  task_started: ["virtual_assistant"],
  task_finished: ["virtual_assistant"],
  task_shift_started: ["virtual_assistant"],
  task_shift_ended: ["virtual_assistant"],
  availability_submitted: ["chatter", "virtual_assistant"],
};
