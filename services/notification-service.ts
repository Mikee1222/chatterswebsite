"use server";

import { createNotification, getUnreadCount } from "./notifications";
import { getPreferencesByUserId } from "./notification-preferences";
import { getActiveSubscriptionsForUser } from "./push-subscriptions";
import { broadcastRealtimeEvent } from "@/lib/realtime-broadcast";
import { sendWebPush } from "@/lib/web-push-server";
import { getPushTargetPath } from "@/lib/notification-routes";
import type {
  NotificationCategory,
  NotificationEventType,
  NotificationPriority,
  NotificationPreference,
} from "@/types";

const EVENT_TO_CATEGORY: Record<NotificationEventType, NotificationCategory> = {
  shift_started: "shift",
  shift_ended: "shift",
  break_started: "shift",
  break_ended: "shift",
  task_started: "task_shift",
  task_finished: "task_shift",
  model_became_free: "model",
  model_taken: "model",
  whale_followup: "whale",
  whale_spent: "whale",
  whale_session_submitted: "whale",
  custom_request_submitted: "system",
  custom_status_changed: "system",
  system_alert: "system",
  account_update: "account",
};

const CATEGORY_TO_PREF_KEY: Record<NotificationCategory, keyof {
  whale_alerts: boolean;
  shift_alerts: boolean;
  model_alerts: boolean;
  system_alerts: boolean;
  task_alerts: boolean;
}> = {
  shift: "shift_alerts",
  task_shift: "task_alerts",
  model: "model_alerts",
  whale: "whale_alerts",
  system: "system_alerts",
  account: "system_alerts",
};

function isInQuietHours(prefs: { quiet_hours_start: string; quiet_hours_end: string }): boolean {
  const start = prefs.quiet_hours_start?.trim();
  const end = prefs.quiet_hours_end?.trim();
  if (!start || !end) return false;
  const now = new Date();
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const startMins = startH * 60 + (startM || 0);
  let endMins = endH * 60 + (endM || 0);
  if (endMins <= startMins) endMins += 24 * 60;
  return nowMins >= startMins && nowMins < endMins;
}

function shouldSendPush(
  prefs: NotificationPreference,
  category: NotificationCategory,
  priority: NotificationPriority
): boolean {
  if (prefs.mute_all) return false;
  if (!prefs.push_enabled) return false;
  const categoryKey = CATEGORY_TO_PREF_KEY[category];
  if (categoryKey && !(prefs[categoryKey] as boolean)) return false;
  if (prefs.critical_only && priority !== "critical" && priority !== "high") return false;
  return true;
}

/** Send web push to one subscription (VAPID). Payload includes url for tap-to-open. */
async function sendPushToSubscription(
  subscription: { endpoint: string; p256dh: string; auth: string; role?: string },
  payload: { title: string; body: string; entity_type: string }
): Promise<void> {
  const path = getPushTargetPath(payload.entity_type, subscription.role as "admin" | "manager" | "chatter" | "virtual_assistant" | undefined);
  await sendWebPush(
    { endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth },
    { title: payload.title, body: payload.body, url: path, tag: payload.entity_type }
  );
}

export type NotifyOptions = {
  user_id: string;
  event_type: NotificationEventType;
  priority: NotificationPriority;
  title: string;
  body: string;
  entity_type: string;
  entity_id: string;
};

/**
 * Main entry: create notification record, then optionally send push based on preferences.
 * Step 1: Create record in notifications table.
 * Step 2: Load notification_preferences for user.
 * Step 3: Check mute_all, push_enabled, critical_only, category.
 * Step 4: If push allowed, fetch active push_subscriptions.
 * Step 5: Send push to each (stubbed).
 */
export async function notify(options: NotifyOptions) {
  const category = EVENT_TO_CATEGORY[options.event_type];
  const notification = await createNotification({
    user_id: options.user_id,
    category,
    event_type: options.event_type,
    priority: options.priority,
    title: options.title,
    body: options.body,
    entity_type: options.entity_type,
    entity_id: options.entity_id,
  });

  const unreadCount = await getUnreadCount(options.user_id).catch(() => 0);
  await broadcastRealtimeEvent(
    "user",
    { type: "notification", notification, unreadCount },
    { userId: options.user_id }
  ).catch(() => {});

  const prefs = await getPreferencesByUserId(options.user_id);
  if (!prefs) return { notification, pushSent: false };

  if (isInQuietHours(prefs)) return { notification, pushSent: false };
  if (!shouldSendPush(prefs, category, options.priority)) return { notification, pushSent: false };

  const subscriptions = await getActiveSubscriptionsForUser(options.user_id);
  for (const sub of subscriptions) {
    await sendPushToSubscription(
      { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, role: sub.role },
      { title: options.title, body: options.body, entity_type: options.entity_type }
    ).catch(() => {});
  }

  return { notification, pushSent: subscriptions.length > 0 };
}

/** Comma-separated Airtable user record IDs for admins (optional). When set, notifyAdmins creates a notification for each. */
function getAdminAirtableUserIds(): string[] {
  const raw = process.env.ADMIN_AIRTABLE_USER_IDS;
  if (!raw || typeof raw !== "string") return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export type NotifyAdminsOptions = Omit<NotifyOptions, "user_id">;

/** Create a notification for each admin user (from ADMIN_AIRTABLE_USER_IDS). Used for whale/custom events. */
export async function notifyAdmins(options: NotifyAdminsOptions) {
  const adminIds = getAdminAirtableUserIds();
  for (const user_id of adminIds) {
    await notify({ ...options, user_id }).catch(() => {});
  }
}
