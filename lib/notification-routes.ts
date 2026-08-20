/**
 * Role-aware notification routing and labels.
 * Used by notification center, toasts, and push payloads.
 */

import type { AppNotification } from "@/types";
import type { UserRole } from "@/types";
import { ROUTES } from "@/lib/routes";
import { parseApplicationResponseEntityId } from "@/lib/application-notifications";

/** Build target path for push notification click (entity_type + role). Used by backend when sending push. */
export function getPushTargetPath(
  entityType: string,
  role?: UserRole | null,
  entityId?: string | null,
): string {
  const isAdmin = role === "admin" || role === "manager";
  const isModel = role === "model";
  const isVa = role === "virtual_assistant";
  const isChatter = role === "chatter";
  const isClient = role === "client";
  switch (entityType) {
    case "whale":
      return isAdmin ? ROUTES.admin.whales : ROUTES.chatter.logTransaction;
    case "shift":
      return isAdmin ? ROUTES.admin.liveShifts : ROUTES.chatter.shift;
    case "task_shift":
      return ROUTES.va.liveShifts;
    case "va_task":
      return ROUTES.va.tasks;
    case "va_task_phase":
    case "va_task_phase_item":
      return isAdmin ? ROUTES.admin.vaTasks : ROUTES.va.tasks;
    case "va_content_assignment":
      if (isModel) return ROUTES.model.contentCalendar;
      return ROUTES.va.contentAssignments;
    case "model":
      return isAdmin ? ROUTES.admin.models : ROUTES.chatter.myWhales;
    case "model_live_stream":
      if (isAdmin) return ROUTES.admin.liveShifts;
      if (isModel) return ROUTES.model.liveStreams;
      return ROUTES.va.liveShifts;
    case "model_content_request":
      if (isAdmin) return ROUTES.admin.modelContentRequests;
      if (isModel) return ROUTES.model.home;
      return ROUTES.dashboard;
    case "custom_request":
      if (isAdmin) return ROUTES.admin.customRequests;
      if (isVa) return ROUTES.va.customRequests;
      if (isModel) return ROUTES.model.customs;
      return ROUTES.chatter.requestCustom;
    case "expense_request":
      if (isModel) return ROUTES.model.home;
      return isAdmin ? ROUTES.admin.expenseRequests : ROUTES.model.home;
    case "spin_wheel_spin":
      if (isAdmin) return ROUTES.admin.spinResults;
      return ROUTES.chatter.rewards;
    case "fine_bonus":
      return ROUTES.finesBonuses;
    case "model_period":
      if (isAdmin) return ROUTES.admin.models;
      if (isModel) return ROUTES.model.home;
      return ROUTES.dashboard;
    case "chatter_mistake":
      if (isAdmin) return ROUTES.admin.mistakes;
      if (isChatter) return ROUTES.chatter.mistakes;
      if (isVa) return ROUTES.va.mistakes;
      return ROUTES.dashboard;
    case "shadowban_report":
      if (isAdmin) return ROUTES.admin.marketing;
      if (isVa) return ROUTES.va.marketingAccounts;
      return ROUTES.dashboard;
    case "winner_video":
      if (isAdmin) return ROUTES.admin.winnerVideos;
      if (isVa) return ROUTES.winnerRecreates;
      return ROUTES.dashboard;
    case "creative_script":
      return isAdmin ? ROUTES.admin.winnerVideos : ROUTES.creativeScripts;
    case "filming_assignment":
      return isAdmin ? ROUTES.admin.bunches : ROUTES.shootAssignments;
    case "filming_schedule":
      if (isAdmin) return ROUTES.filmingCalendar;
      if (isModel) return ROUTES.model.schedule;
      return ROUTES.filmingCalendar;
    case "editing_assignment":
      return isAdmin ? ROUTES.admin.bunches : ROUTES.editAssignments;
    case "icloud_organization":
      return isAdmin ? ROUTES.admin.bunches : ROUTES.icloudOrganization;
    case "infloww_performance":
      return isAdmin ? ROUTES.admin.inflowwPerformance : ROUTES.dashboard;
    case "spot_check":
      return isAdmin ? ROUTES.admin.spotChecks : ROUTES.spotChecks;
    case "daily_review":
      return isAdmin ? ROUTES.admin.dailyReview : ROUTES.dailyReview;
    case "model_schedule":
      if (isAdmin) return ROUTES.admin.modelSchedules;
      if (isModel) return ROUTES.model.schedule;
      if (isVa) return ROUTES.va.schedule;
      return ROUTES.dashboard;
    case "challenge":
      if (isAdmin) return ROUTES.admin.challenges;
      return ROUTES.chatter.challenges;
    case "form":
      if (isAdmin) return ROUTES.admin.home;
      return ROUTES.dashboard;
    case "application_form_response": {
      const parsed = entityId ? parseApplicationResponseEntityId(entityId) : null;
      if (parsed && isAdmin) {
        return ROUTES.admin.applicationFormResponseDetail(parsed.formId, parsed.responseId);
      }
      return isAdmin ? ROUTES.admin.applicationForms : ROUTES.dashboard;
    }
    case "tip":
      if (isAdmin) return ROUTES.admin.rebillsTips;
      if (isChatter) return ROUTES.chatter.myRebills;
      return ROUTES.dashboard;
    case "billing_cycle":
      return isClient ? ROUTES.client.paymentHistory : ROUTES.admin.billing;
    case "payment_submission":
      return isClient ? ROUTES.client.paymentHistory : ROUTES.admin.submissions;
    case "rebill":
      return isAdmin ? ROUTES.admin.rebillsTips : ROUTES.chatter.myRebills;
    case "sop_academy":
      return isAdmin ? ROUTES.admin.sopLibrary : ROUTES.sops;
    case "system":
    case "account":
      return isClient ? ROUTES.client.home : ROUTES.settings;
    default:
      return isClient ? ROUTES.client.home : "/home";
  }
}

export function getEntityUrl(n: AppNotification, role?: UserRole | null): string | null {
  const { entity_type, entity_id, event_type } = n;
  if (!entity_id) return null;
  const isAdmin = role === "admin" || role === "manager";
  // Prefer event-specific deep links for system digests
  if (isAdmin && event_type === "va_statistics_weekly_summary") return ROUTES.admin.vaStatistics;
  if (isAdmin && event_type === "daily_summary") return ROUTES.admin.home;
  const isModel = role === "model";
  const isVa = role === "virtual_assistant";
  const isClient = role === "client";
  switch (entity_type) {
    case "whale":
      return isAdmin ? ROUTES.admin.whales : ROUTES.chatter.logTransaction;
    case "shift":
      return isAdmin ? ROUTES.admin.liveShifts : ROUTES.chatter.shift;
    case "task_shift":
      return ROUTES.va.liveShifts;
    case "va_task":
      return ROUTES.va.tasks;
    case "va_task_phase":
    case "va_task_phase_item":
      return isAdmin ? ROUTES.admin.vaTasks : ROUTES.va.tasks;
    case "va_content_assignment":
      if (isModel) return ROUTES.model.contentCalendar;
      return ROUTES.va.contentAssignments;
    case "model":
      return isAdmin ? ROUTES.admin.models : ROUTES.chatter.myWhales;
    case "model_live_stream":
      if (isAdmin) return ROUTES.admin.liveShifts;
      if (isModel) return ROUTES.model.liveStreams;
      return ROUTES.va.liveShifts;
    case "model_content_request":
      if (isAdmin) return ROUTES.admin.modelContentRequests;
      if (isModel) return ROUTES.model.home;
      return ROUTES.dashboard;
    case "custom_request":
      if (isAdmin) return ROUTES.admin.customRequests;
      if (isVa) return ROUTES.va.customRequests;
      if (isModel) return ROUTES.model.customs;
      return ROUTES.chatter.requestCustom;
    case "expense_request":
      if (isModel) return ROUTES.model.home;
      return isAdmin ? ROUTES.admin.expenseRequests : ROUTES.model.home;
    case "spin_wheel_spin":
      if (isAdmin) return ROUTES.admin.spinResults;
      return ROUTES.chatter.rewards;
    case "fine_bonus":
      return ROUTES.finesBonuses;
    case "shadowban_report":
      if (isAdmin) return ROUTES.admin.marketing;
      if (isVa) return ROUTES.va.marketingAccounts;
      return ROUTES.dashboard;
    case "winner_video":
      if (isAdmin) return ROUTES.admin.winnerVideos;
      if (isVa) return ROUTES.winnerRecreates;
      return ROUTES.dashboard;
    case "creative_script":
      return isAdmin ? ROUTES.admin.winnerVideos : ROUTES.creativeScripts;
    case "filming_assignment":
      return isAdmin ? ROUTES.admin.bunches : ROUTES.shootAssignments;
    case "filming_schedule":
      if (isAdmin) return ROUTES.filmingCalendar;
      if (isModel) return ROUTES.model.schedule;
      return ROUTES.filmingCalendar;
    case "editing_assignment":
      return isAdmin ? ROUTES.admin.bunches : ROUTES.editAssignments;
    case "icloud_organization":
      return isAdmin ? ROUTES.admin.bunches : ROUTES.icloudOrganization;
    case "infloww_performance":
      return isAdmin ? ROUTES.admin.inflowwPerformance : ROUTES.dashboard;
    case "spot_check":
      return isAdmin ? ROUTES.admin.spotChecks : ROUTES.spotChecks;
    case "daily_review":
      return isAdmin ? ROUTES.admin.dailyReview : ROUTES.dailyReview;
    case "tip":
      return isAdmin ? ROUTES.admin.rebillsTips : ROUTES.chatter.myRebills;
    case "model_schedule":
      if (isAdmin) return ROUTES.admin.modelSchedules;
      if (isModel) return ROUTES.model.schedule;
      if (isVa) return ROUTES.va.schedule;
      return ROUTES.dashboard;
    case "billing_cycle":
      return isClient ? ROUTES.client.paymentHistory : ROUTES.admin.billing;
    case "payment_submission":
      return isClient ? ROUTES.client.paymentHistory : ROUTES.admin.submissions;
    case "rebill":
      return isAdmin ? ROUTES.admin.rebillsTips : ROUTES.chatter.myRebills;
    case "sop_academy":
      return isAdmin ? ROUTES.admin.sopLibrary : ROUTES.sops;
    case "application_form_response": {
      const parsed = parseApplicationResponseEntityId(entity_id);
      if (parsed && isAdmin) {
        return ROUTES.admin.applicationFormResponseDetail(parsed.formId, parsed.responseId);
      }
      return isAdmin ? ROUTES.admin.applicationForms : null;
    }
    case "system":
    case "account":
      return isClient ? ROUTES.client.home : ROUTES.settings;
    default:
      return null;
  }
}

/** Short label for event type (e.g. "Shift", "Whale", "Custom") for tags. */
export function getEventTag(eventType: AppNotification["event_type"]): string {
  switch (eventType) {
    case "shift_started":
    case "shift_ended":
    case "break_started":
    case "break_ended":
    case "shift_late":
    case "shift_starting_soon":
    case "shift_no_show":
    case "shift_overtime":
    case "shift_running_long":
    case "chatter_no_models":
    case "break_exceeded":
    case "break_too_long":
      return "Shift";
    case "whale_registered":
    case "whale_assigned":
    case "whale_session_submitted":
    case "whale_spent":
    case "whale_followup":
      return "Whale";
    case "custom_request_submitted":
    case "custom_request_created":
    case "custom_request_updated":
    case "custom_status_changed":
    case "custom_approved":
    case "custom_rejected":
    case "custom_declined":
    case "custom_edited":
    case "custom_uploaded":
    case "custom_request_uploaded":
    case "custom_scheduled":
    case "custom_deadline_approaching":
    case "custom_overdue":
      return "Custom";
    case "task_started":
    case "task_finished":
    case "task_shift_started":
    case "task_shift_ended":
    case "task_completed":
    case "task_overdue":
    case "tasks_not_started":
    case "va_task_reminder":
    case "va_task_assigned":
    case "model_content_request_created":
    case "model_content_request_reviewed":
    case "model_content_completed":
    case "model_content_scheduled":
    case "va_content_assigned":
    case "va_content_scheduled":
    case "va_content_completed":
    case "phase_task_completed":
    case "phase_completed":
    case "phase_overdue":
    case "all_phases_completed":
      return "Task";
    case "model_became_free":
    case "model_taken":
    case "model_live_started":
    case "model_live_ended":
    case "model_live_scheduled":
    case "model_missed_live":
      return "Model";
    case "form_submitted":
    case "schedule_updated":
    case "schedule_published":
    case "weekly_availability_friday_reminder":
    case "availability_submitted":
      return "Form";
    case "application_submitted":
    case "application_status_changed":
      return "Application";
    case "sop_quiz_passed":
    case "sop_quiz_failed":
      return "Training";
    case "shadowban_submitted":
    case "shadowban_resolved":
    case "shadowban_lifted_reported":
    case "winner_video_approved":
    case "winner_video_rejected":
    case "winner_video_submitted":
    case "research_assigned_to_creative":
    case "creative_script_submitted":
    case "creative_script_approved":
    case "creative_script_rejected":
    case "creative_script_resubmitted":
    case "bunch_assigned_to_filmer":
    case "bunch_filming_uploaded":
    case "filming_schedule_created":
    case "bunch_assigned_to_editor":
    case "bunch_editing_uploaded":
    case "bunch_icloud_organized":
    case "recreate_video_slot_deleted":
    case "material_until_approaching":
    case "infloww_performance_alert":
    case "spot_check_logged":
    case "spot_check_status_changed":
    case "daily_review_submitted":
    case "daily_review_saved":
      return "Marketing";
    case "login_new_device":
    case "password_changed":
      return "System";
    case "billing_cycle_announced":
    case "billing_due_reminder":
    case "billing_payment_submitted":
    case "payment_submitted":
    case "payment_confirmed":
    case "payment_rejected":
      return "Billing";
    case "expense_approved":
    case "expense_rejected":
      return "Expense";
    case "tip_approved":
    case "tip_rejected":
    case "rebill_verified":
    case "rebill_rejected":
    case "rebill_submitted":
    case "extra_revenue_submitted":
      return "Rebill";
    case "expense_submitted":
      return "Expense";
    case "model_schedule_created":
    case "period_logged":
      return "Model";
    case "time_off_requested":
      return "Model";
    case "feedback_submitted":
      return "System";
    case "fine_issued":
    case "fine_issued_admin":
    case "bonus_awarded":
    case "bonus_awarded_admin":
    case "fine_bonus_reviewed":
    case "fine_bonus_reviewed_admin":
      return "Fine/Bonus";
    case "chatter_mistake":
    case "chatter_mistake_reviewed":
      return "Mistake";
    case "user_created":
    case "role_changed":
    case "account_deleted":
    case "account_update":
    case "daily_summary":
    case "va_statistics_weekly_summary":
      return "System";
    default:
      return "Alert";
  }
}

/** Admin operational-priority events: highlight in Important filter. */
export function isAdminPriorityEvent(eventType: AppNotification["event_type"]): boolean {
  return (
    eventType === "whale_session_submitted" ||
    eventType === "whale_registered" ||
    eventType === "whale_assigned" ||
    eventType === "custom_request_submitted" ||
    eventType === "custom_request_created" ||
    eventType === "custom_request_updated" ||
    eventType === "custom_approved" ||
    eventType === "custom_rejected" ||
    eventType === "custom_declined" ||
    eventType === "custom_edited" ||
    eventType === "custom_uploaded" ||
    eventType === "custom_scheduled" ||
    eventType === "custom_deadline_approaching" ||
    eventType === "custom_overdue" ||
    eventType === "break_started" ||
    eventType === "break_ended" ||
    eventType === "break_exceeded" ||
    eventType === "break_too_long" ||
    eventType === "shift_started" ||
    eventType === "shift_ended" ||
    eventType === "shift_late" ||
    eventType === "shift_starting_soon" ||
    eventType === "shift_no_show" ||
    eventType === "shift_overtime" ||
    eventType === "shift_running_long" ||
    eventType === "chatter_no_models" ||
    eventType === "task_started" ||
    eventType === "task_finished" ||
    eventType === "task_shift_started" ||
    eventType === "task_shift_ended" ||
    eventType === "task_completed" ||
    eventType === "task_overdue" ||
    eventType === "tasks_not_started" ||
    eventType === "model_live_started" ||
    eventType === "model_live_ended" ||
    eventType === "model_live_scheduled" ||
    eventType === "model_missed_live" ||
    eventType === "model_content_completed" ||
    eventType === "form_submitted" ||
    eventType === "payment_submitted" ||
    eventType === "billing_payment_submitted" ||
    eventType === "schedule_updated" ||
    eventType === "availability_submitted" ||
    eventType === "user_created" ||
    eventType === "role_changed" ||
    eventType === "account_deleted");
}
