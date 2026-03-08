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
  switch (entityType) {
    case "whale":
      return isAdmin ? ROUTES.admin.whales : ROUTES.chatter.logTransaction;
    case "shift":
      return isAdmin ? ROUTES.admin.liveShifts : ROUTES.chatter.shift;
    case "task_shift":
      return ROUTES.va.liveShifts;
    case "model":
      return isAdmin ? ROUTES.admin.models : ROUTES.chatter.myWhales;
    case "custom_request":
      return isAdmin ? ROUTES.admin.customs : ROUTES.chatter.requestCustom;
    case "system":
    case "account":
      return ROUTES.settings;
    default:
      return "/home";
  }
}

export function getEntityUrl(n: AppNotification, role?: UserRole | null): string | null {
  const { entity_type, entity_id } = n;
  if (!entity_id) return null;
  const isAdmin = role === "admin" || role === "manager";
  switch (entity_type) {
    case "whale":
      return isAdmin ? ROUTES.admin.whales : ROUTES.chatter.logTransaction;
    case "shift":
      return isAdmin ? ROUTES.admin.liveShifts : ROUTES.chatter.shift;
    case "task_shift":
      return ROUTES.va.liveShifts;
    case "model":
      return isAdmin ? ROUTES.admin.models : ROUTES.chatter.myWhales;
    case "custom_request":
      return isAdmin ? ROUTES.admin.customs : ROUTES.chatter.requestCustom;
    case "system":
    case "account":
      return ROUTES.settings;
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
      return "Shift";
    case "whale_session_submitted":
    case "whale_spent":
    case "whale_followup":
      return "Whale";
    case "custom_request_submitted":
    case "custom_status_changed":
      return "Custom";
    case "task_started":
    case "task_finished":
      return "Task";
    case "model_became_free":
    case "model_taken":
      return "Model";
    default:
      return "Alert";
  }
}

/** Admin operational-priority events: highlight more strongly. */
export function isAdminPriorityEvent(eventType: AppNotification["event_type"]): boolean {
  return (
    eventType === "whale_session_submitted" ||
    eventType === "custom_request_submitted" ||
    eventType === "break_started" ||
    eventType === "shift_started" ||
    eventType === "shift_ended"
  );
}
