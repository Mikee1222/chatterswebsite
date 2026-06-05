"use client";

import * as React from "react";
import {
  Play,
  Coffee,
  ClipboardList,
  ListTodo,
  Gem,
  DollarSign,
  Radio,
  Bell,
  type LucideIcon,
} from "lucide-react";
import type { NotificationCategory, NotificationPriority } from "@/types";
import { getEventTag as getEventTagFromRoutes } from "@/lib/notification-routes";
import type { NotificationEventType } from "@/types";
import { formatDateTime } from "@/lib/format-date";

/**
 * Human-readable time plus full absolute string for tooltips / aria.
 * Recent items stay compact (e.g. "3m ago"); older items show date + time.
 */
export function formatNotificationTime(iso: string): { label: string; title: string } {
  try {
    const d = new Date(iso);
    const title = formatDateTime(iso);
    if (Number.isNaN(d.getTime())) return { label: "", title };
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 60_000) return { label: "Just now", title };
    if (diffMs < 3600_000) return { label: `${Math.floor(diffMs / 60_000)}m ago`, title };
    if (diffMs < 86400_000) return { label: `${Math.floor(diffMs / 3600_000)}h ago`, title };
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startYesterday = startToday - 86400_000;
    const t = d.getTime();
    if (t >= startYesterday && t < startToday) {
      const timeOnly = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      return { label: `Yesterday · ${timeOnly}`, title };
    }
    return { label: formatDateTime(iso), title };
  } catch {
    return { label: "", title: "" };
  }
}

/** Short label only (backwards compatible). */
export function formatTime(iso: string): string {
  return formatNotificationTime(iso).label;
}

export function getEventTag(eventType: NotificationEventType): string {
  return getEventTagFromRoutes(eventType);
}

/**
 * Single tasteful emoji per event type for title display only. 1 emoji max per notification.
 * Used to improve scannability; never more than one, only where it reinforces meaning.
 */
export function getTitleEmoji(eventType: NotificationEventType): string {
  switch (eventType) {
    case "shift_started":
      return "⚡";
    case "shift_ended":
      return "✅";
    case "break_started":
      return "☕";
    case "break_ended":
      return "✅";
    case "shift_late":
    case "shift_starting_soon":
    case "shift_no_show":
    case "shift_overtime":
    case "shift_running_long":
    case "chatter_no_models":
    case "break_exceeded":
    case "break_too_long":
    case "model_missed_live":
    case "task_overdue":
    case "tasks_not_started":
    case "custom_deadline_approaching":
    case "custom_overdue":
      return "⚠️";
    case "model_live_started":
      return "🔴";
    case "model_live_ended":
      return "⏹️";
    case "model_live_scheduled":
      return "📅";
    case "model_content_scheduled":
    case "va_content_assigned":
    case "va_content_scheduled":
      return "📅";
    case "model_content_completed":
    case "va_content_completed":
    case "task_completed":
    case "task_finished":
    case "task_shift_ended":
      return "✔️";
    case "custom_request_created":
    case "custom_request_submitted":
      return "💎";
    case "custom_approved":
      return "🎬";
    case "custom_rejected":
    case "custom_declined":
      return "❌";
    case "custom_edited":
      return "✏️";
    case "custom_uploaded":
    case "custom_request_uploaded":
      return "📤";
    case "custom_scheduled":
      return "📅";
    case "form_submitted":
    case "availability_submitted":
      return "📝";
    case "schedule_updated":
    case "weekly_availability_friday_reminder":
      return "📅";
    case "whale_session_submitted":
    case "whale_registered":
    case "whale_assigned":
    case "whale_followup":
    case "whale_spent":
      return "💰";
    case "user_created":
    case "role_changed":
    case "account_deleted":
    case "system_alert":
    case "account_update":
      return "⚙️";
    case "daily_summary":
      return "📊";
    default:
      return "";
  }
}

/**
 * Category system: icon + color accent + subtle glow.
 * Apple/Linear-style: shifts (play, pink), breaks (coffee, amber), tasks (checklist, purple),
 * forms (clipboard, blue), customs (gem, pink/purple), payments (green), live (radio, purple), system (gray).
 */
const CATEGORY_CONFIG: Record<
  NotificationCategory,
  { Icon: LucideIcon; accent: string; bg: string; label: string }
> = {
  shift: {
    Icon: Play,
    accent: "hsl(330, 78%, 58%)",
    bg: "hsla(330, 78%, 58%, 0.14)",
    label: "Shift",
  },
  model: {
    Icon: Radio,
    accent: "hsl(270, 65%, 62%)",
    bg: "hsla(270, 65%, 62%, 0.14)",
    label: "Live",
  },
  whale: {
    Icon: DollarSign,
    accent: "hsl(152, 55%, 42%)",
    bg: "hsla(152, 55%, 42%, 0.14)",
    label: "Payments",
  },
  custom_request: {
    Icon: Gem,
    accent: "hsl(295, 70%, 62%)",
    bg: "hsla(295, 70%, 62%, 0.14)",
    label: "Custom",
  },
  task: {
    Icon: ListTodo,
    accent: "hsl(262, 65%, 58%)",
    bg: "hsla(262, 65%, 58%, 0.14)",
    label: "Task",
  },
  system: {
    Icon: Bell,
    accent: "hsl(0, 0%, 58%)",
    bg: "hsla(0, 0%, 58%, 0.12)",
    label: "System",
  },
  billing: {
    Icon: DollarSign,
    accent: "hsl(142, 55%, 45%)",
    bg: "hsla(142, 55%, 45%, 0.14)",
    label: "Billing",
  },
};

/** Overrides by event type (e.g. break, form) for clearer identity. */
export const NOTIFICATION_CATEGORY_ICON = {
  break: { Icon: Coffee, accent: "hsl(32, 82%, 52%)", bg: "hsla(32, 82%, 52%, 0.14)", label: "Break" },
  form: { Icon: ClipboardList, accent: "hsl(208, 75%, 52%)", bg: "hsla(208, 75%, 52%, 0.14)", label: "Form" },
} as const;

export function getCategoryConfig(
  category: NotificationCategory,
  eventType?: string
): { Icon: LucideIcon; accent: string; bg: string; label: string } {
  if (eventType === "break_started" || eventType === "break_ended" || eventType === "break_exceeded" || eventType === "break_too_long") {
    return NOTIFICATION_CATEGORY_ICON.break;
  }
  if (eventType === "form_submitted" || eventType === "schedule_updated" || eventType === "availability_submitted") {
    return NOTIFICATION_CATEGORY_ICON.form;
  }
  return CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.system;
}

export function getPriorityStyle(priority: NotificationPriority): {
  borderColor: string;
  glowOpacity: number;
  label: string;
} {
  switch (priority) {
    case "critical":
      return { borderColor: "hsl(0, 75%, 55%)", glowOpacity: 0.3, label: "Critical" };
    case "high":
      return { borderColor: "hsl(330, 78%, 58%)", glowOpacity: 0.15, label: "High" };
    case "normal":
      return { borderColor: "hsla(255, 255%, 255%, 0.12)", glowOpacity: 0, label: "Normal" };
    case "low":
      return { borderColor: "hsla(255, 255%, 255%, 0.06)", glowOpacity: 0, label: "Low" };
    default:
      return { borderColor: "hsla(255, 255%, 255%, 0.12)", glowOpacity: 0, label: "Normal" };
  }
}

type NotificationCategoryIconProps = {
  category: NotificationCategory;
  eventType?: string;
  size?: number;
  className?: string;
  withBg?: boolean;
};

export function NotificationCategoryIcon({
  category,
  eventType,
  size = 20,
  className = "",
  withBg = true,
}: NotificationCategoryIconProps) {
  const config = getCategoryConfig(category, eventType);
  const { Icon, accent, bg } = config;
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl ${className}`}
      style={{
        width: size + 12,
        height: size + 12,
        backgroundColor: withBg ? bg : "transparent",
        color: accent,
      }}
      aria-hidden
    >
      <Icon size={size} strokeWidth={2} />
    </span>
  );
}
