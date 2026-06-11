/**
 * Role-aware notification routing and labels.
 * Used by notification center, toasts, and push payloads.
 */

import type { AppNotification } from "@/types";
import type { UserRole } from "@/types";
import { ROUTES } from "@/lib/routes";

/** Build target path for push notification click (entity_type + role). Used by backend when sending push. */
export function getPushTargetPath(entityType: string, role?: UserRole | null): string {
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
      return ROUTES.va.tasks;
    case "model":
      return isAdmin ? ROUTES.admin.models : ROUTES.chatter.myWhales;
    case "model_live_stream":
      if (isAdmin) return ROUTES.admin.liveShifts;
      if (isModel) return ROUTES.model.liveStreams;
      return ROUTES.va.liveShifts;
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
    case "challenge":
      if (isAdmin) return ROUTES.admin.challenges;
      return ROUTES.chatter.challenges;
    case "form":
      if (isAdmin) return ROUTES.admin.home;
      return ROUTES.dashboard;
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
  const { entity_type, entity_id } = n;
  if (!entity_id) return null;
  const isAdmin = role === "admin" || role === "manager";
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
      return ROUTES.va.tasks;
    case "model":
      return isAdmin ? ROUTES.admin.models : ROUTES.chatter.myWhales;
    case "model_live_stream":
      if (isAdmin) return ROUTES.admin.liveShifts;
      if (isModel) return ROUTES.model.liveStreams;
      return ROUTES.va.liveShifts;
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
    case "weekly_availability_friday_reminder":
    case "availability_submitted":
      return "Form";
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
    case "user_created":
    case "role_changed":
    case "account_deleted":
    case "account_update":
    case "daily_summary":
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
