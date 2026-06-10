"use server";

import { createNotification, getUnreadCount } from "./notifications";
import { getPreferencesByUserId } from "./notification-preferences";
import { getActiveSubscriptionsForUser } from "./push-subscriptions";
import { listAllUsers } from "./users";
import { getAdminNotificationIds } from "./admin-notification-settings";
import {
  DEFAULT_PRIORITY_BY_EVENT as DEFAULT_PRIORITY_BY_EVENT_BASE,
  NOTIFICATION_ENTITY,
} from "@/lib/notification-types";
import { CATEGORY_TO_AIRTABLE, EVENT_TYPE_TO_AIRTABLE } from "@/lib/notifications-schema";
import { broadcastRealtimeEvent } from "@/lib/realtime-broadcast";
import { sendWebPush } from "@/lib/web-push-server";
import { getPushTargetPath } from "@/lib/notification-routes";
import type {
  NotificationCategory,
  NotificationEventType,
  NotificationPriority,
  NotificationPreference,
} from "@/types";
import { devLog } from "@/lib/dev-log";

/** Map event type to Airtable category. Categories must match Airtable single-select. */
const EVENT_TO_CATEGORY: Record<NotificationEventType, NotificationCategory> = {
  shift_started: "shift",
  shift_ended: "shift",
  shift_late: "shift",
  shift_no_show: "shift",
  shift_overtime: "shift",
  shift_running_long: "shift",
  shift_starting_soon: "shift",
  chatter_no_models: "shift",
  break_started: "shift",
  break_ended: "shift",
  break_exceeded: "shift",
  break_too_long: "shift",
  task_shift_started: "task",
  task_shift_ended: "task",
  task_started: "task",
  task_finished: "task",
  task_completed: "task",
  task_overdue: "task",
  tasks_not_started: "task",
  va_task_reminder: "task",
  phase_task_completed: "task",
  phase_completed: "task",
  phase_overdue: "task",
  all_phases_completed: "task",
  model_became_free: "model",
  model_taken: "model",
  /** Live events: gated by notification_preferences.model_alerts (see CATEGORY_TO_PREF_KEY). */
  model_live_started: "model",
  model_live_ended: "model",
  model_live_scheduled: "model",
  model_missed_live: "model",
  model_content_completed: "task",
  model_content_scheduled: "task",
  va_content_assigned: "task",
  va_content_scheduled: "task",
  va_content_completed: "task",
  custom_request_uploaded: "custom_request",
  period_3_day_reminder: "model",
  period_predicted_day: "model",
  period_confirmed_early: "model",
  period_overdue: "model",
  period_prediction_reset: "model",
  whale_registered: "whale",
  whale_assigned: "whale",
  whale_followup: "whale",
  whale_spent: "whale",
  whale_session_submitted: "whale",
  custom_request_created: "custom_request",
  custom_request_updated: "custom_request",
  custom_request_submitted: "custom_request",
  custom_status_changed: "custom_request",
  custom_approved: "custom_request",
  custom_rejected: "custom_request",
  custom_declined: "custom_request",
  custom_edited: "custom_request",
  custom_uploaded: "custom_request",
  custom_scheduled: "custom_request",
  custom_deadline_approaching: "custom_request",
  custom_overdue: "custom_request",
  form_submitted: "system",
  schedule_updated: "system",
  weekly_availability_friday_reminder: "system",
  availability_submitted: "system",
  system_alert: "system",
  account_update: "system",
  user_created: "system",
  role_changed: "system",
  account_deleted: "system",
  daily_summary: "system",
  points_awarded: "system",
  level_up: "system",
  spin_available: "system",
  challenge_completed: "system",
  billing_cycle_announced: "billing",
  billing_due_reminder: "billing",
  billing_payment_submitted: "billing",
  payment_submitted: "billing",
  payment_confirmed: "billing",
  payment_rejected: "billing",
  sop_academy_reminder: "system",
  sop_academy_training_complete: "system",
  sop_academy_signed_off: "system",
};

/** Service-layer defaults (merges lib/notification-types + model session events). */
const DEFAULT_PRIORITY_BY_EVENT: Partial<Record<NotificationEventType, NotificationPriority>> = {
  ...DEFAULT_PRIORITY_BY_EVENT_BASE,
  model_became_free: "normal",
  model_taken: "normal",
  va_task_reminder: "high",
};

function resolveNotifyPriority(
  event_type: NotificationEventType,
  explicit?: NotificationPriority
): NotificationPriority {
  return explicit ?? DEFAULT_PRIORITY_BY_EVENT[event_type] ?? "normal";
}

type NotificationPreferenceGateKey = keyof Pick<
  NotificationPreference,
  | "whale_alerts"| "shift_alerts"| "model_alerts"| "system_alerts"| "task_alerts"| "mistake_alerts"| "fine_bonus_alerts"| "period_alerts"| "marketing_alerts"| "phase_alerts"| "reward_alerts"
>;

const CATEGORY_TO_PREF_KEY: Record<NotificationCategory, NotificationPreferenceGateKey> = {
  shift: "shift_alerts",
  model: "model_alerts",
  whale: "whale_alerts",
  custom_request: "system_alerts",
  system: "system_alerts",
  task: "task_alerts",
  billing: "system_alerts",
};

const EVENT_TO_PREF_KEY: Partial<Record<NotificationEventType, NotificationPreferenceGateKey>> = {
  billing_due_reminder: "system_alerts",
  billing_cycle_announced: "period_alerts",
  payment_confirmed: "task_alerts",
  payment_rejected: "task_alerts",
  period_3_day_reminder: "period_alerts",
  period_predicted_day: "period_alerts",
  period_confirmed_early: "period_alerts",
  period_overdue: "period_alerts",
  period_prediction_reset: "period_alerts",
  phase_task_completed: "phase_alerts",
  phase_completed: "phase_alerts",
  phase_overdue: "phase_alerts",
  all_phases_completed: "phase_alerts",
  points_awarded: "reward_alerts",
  level_up: "reward_alerts",
  spin_available: "reward_alerts",
  challenge_completed: "reward_alerts",
};

const ENTITY_TO_PREF_KEY: Record<string, NotificationPreferenceGateKey> = {
  [NOTIFICATION_ENTITY.CHATTER_MISTAKE]: "mistake_alerts",
  [NOTIFICATION_ENTITY.FINE_BONUS]: "fine_bonus_alerts",
  shadowban_report: "marketing_alerts",
  challenge: "reward_alerts",
  chatter_points: "reward_alerts",
  points_transaction: "reward_alerts",
  spin_wheel_spin: "reward_alerts",
};

function resolvePreferenceKey(
  eventType: NotificationEventType,
  category: NotificationCategory,
  entityType?: string,
  triggerSource?: string
): NotificationPreferenceGateKey {
  const entityKey = entityType?.trim() ?? "";
  const triggerKey = triggerSource?.trim().toLowerCase() ?? "";
  const entityPref = ENTITY_TO_PREF_KEY[entityKey];
  if (entityPref) return entityPref;
  if (
    entityKey === NOTIFICATION_ENTITY.ACCOUNT &&
    (triggerKey.includes("marketing") || triggerKey.includes("shadowban"))
  ) {
    return "marketing_alerts";
  }
  return EVENT_TO_PREF_KEY[eventType] ?? CATEGORY_TO_PREF_KEY[category];
}

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

const PUSH_DEBUG = "[push-debug]";
const LIVE_NOTIF = "[live-notif]";
const NOTIF = "[NOTIF]";
/** Grep-friendly: single-line push delivery outcome (sent vs skipped + why). */
const PUSH_AUDIT = "[push-audit]";

/** Mask Airtable record IDs for logs (never log full env value). */
function maskAirtableId(id: string): string {
  const t = id.trim();
  if (t.length <= 8) return "***";
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

function logAdminAirtableUserIdsEnv(context: string, resolvedIds: string[]) {
  devLog(
    NOTIF,
    "admin_notification_recipients_masked",
    JSON.stringify({
      context,
      resolved_count: resolvedIds.length,
      masked_ids: resolvedIds.map(maskAirtableId),
      note: "from system_settings admin_notification_ids JSON or ADMIN_AIRTABLE_USER_IDS env fallback",
    })
  );
}

function isLiveNotificationEvent(eventType: string, triggerSource?: string): boolean {
  return (
    eventType === "model_live_started" ||
    eventType === "model_live_ended" ||
    (triggerSource != null && (triggerSource === "live_start_chatter" || triggerSource === "live_end_chatter"))
  );
}

function shouldSendPush(
  prefs: NotificationPreference,
  category: NotificationCategory,
  priority: NotificationPriority,
  eventType: NotificationEventType,
  entityType?: string,
  triggerSource?: string
): { send: boolean; skipReason?: string } {
  if (prefs.mute_all) return { send: false, skipReason: "mute_all is true" };
  if (!prefs.push_enabled) return { send: false, skipReason: "push_enabled is false" };
  const categoryKey = resolvePreferenceKey(eventType, category, entityType, triggerSource);
  if (categoryKey && !(prefs[categoryKey] as boolean))
    return { send: false, skipReason: `category preference ${categoryKey} is false` };
  if (prefs.critical_only && priority !== "critical" && priority !== "high")
    return { send: false, skipReason: `critical_only is true and priority "${priority}" is not critical/high` };
  return { send: true };
}

/** Log-only: which Airtable boolean column gates push for this category (shift → shift_alerts, etc.). */
function logCategoryPrefKeyReference() {
  const rows = (Object.keys(CATEGORY_TO_PREF_KEY) as NotificationCategory[]).map((c) => ({
    category: c,
    preference_key_checked: CATEGORY_TO_PREF_KEY[c],
  }));
  devLog(PUSH_AUDIT, "category_to_preference_key_map", JSON.stringify({ mappings: rows }));
}

function logNotifyPushOutcome(
  options: NotifyOptions,
  outcome: {
    push_sent: boolean;
    outcome_stage: string;
    detail?: string;
    extra?: Record<string, unknown>;
  }
) {
  devLog(
    PUSH_AUDIT,
    "notify_push_outcome",
    JSON.stringify({
      trigger: options._triggerSource ?? "notify",
      event_type: options.event_type,
      recipient_user_id: options.user_id,
      push_sent: outcome.push_sent,
      outcome_stage: outcome.outcome_stage,
      ...(outcome.detail != null ? { detail: outcome.detail } : {}),
      ...(outcome.extra ?? {}),
    })
  );
}

/** Send web push to one subscription (VAPID). Payload includes url for tap-to-open. Returns true if sent successfully. */
async function sendPushToSubscription(
  subscription: { endpoint: string; p256dh: string; auth: string; role?: string },
  payload: { title: string; body: string; entity_type: string }
): Promise<boolean> {
  const path = getPushTargetPath(payload.entity_type, subscription.role as "admin" | "manager" | "chatter" | "virtual_assistant" | undefined);
  return sendWebPush(
    { endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth },
    { title: payload.title, body: payload.body, url: path, tag: payload.entity_type }
  );
}

/** One subscription at a time (no Promise.all) to stay under Cloudflare Worker subrequest limits. */
async function sendWebPushToSubscriptionsSequentially(
  subscriptions: Array<{ endpoint: string; p256dh: string; auth: string; role?: string }>,
  payload: { title: string; body: string; entity_type: string },
  logRecipientUserId: string,
  eventType?: NotificationEventType
): Promise<number> {
  let pushSuccessCount = 0;
  let index = 0;
  for (const sub of subscriptions) {
    const path = getPushTargetPath(payload.entity_type, sub.role as "admin" | "manager" | "chatter" | "virtual_assistant" | undefined);
    const innerPayload = { title: payload.title, body: payload.body, url: path, tag: payload.entity_type };
    if (eventType === "shift_started") {
      devLog(NOTIF, "web_push_full_payload", JSON.stringify({
        recipient_user_id: logRecipientUserId,
        subscription_index: index,
        endpoint_preview: sub.endpoint?.slice(0, 96),
        role: sub.role ?? null,
        push: innerPayload,
        web_push_message_data_string: JSON.stringify({
          title: payload.title,
          body: payload.body,
          url: path,
          tag: payload.entity_type,
        }),
      }));
    }
    index += 1;
    devLog(PUSH_DEBUG, "sending push now", JSON.stringify({ recipient_user_id: logRecipientUserId, endpoint_preview: sub.endpoint?.slice(0, 60) }));
    const success = await sendPushToSubscription(sub, payload);
    if (success) {
      pushSuccessCount++;
      devLog(PUSH_DEBUG, "push success", JSON.stringify({ recipient_user_id: logRecipientUserId }));
      devLog(NOTIF, "12 after_push_send", JSON.stringify({ success: true, recipient_user_id: logRecipientUserId }));
    } else {
      devLog(PUSH_DEBUG, "push failure with exact error", JSON.stringify({ recipient_user_id: logRecipientUserId, note: "see sendWebPush log above for error" }));
      devLog(NOTIF, "12 after_push_send", JSON.stringify({ success: false, recipient_user_id: logRecipientUserId, error_message: "sendWebPush returned false" }));
    }
  }
  return pushSuccessCount;
}

export type NotifyOptions = {
  user_id: string;
  event_type: NotificationEventType;
  /** When omitted, DEFAULT_PRIORITY_BY_EVENT[event_type] or "normal" is used. */
  priority?: NotificationPriority;
  title: string;
  body: string;
  entity_type: string;
  entity_id: string;
  actor_user_id?: string;
  actor_name?: string;
  /** Optional structured metadata (e.g. models, shift type, deadline) for rich display. */
  metadata?: Array<{ label: string; value: string }>;
  _triggerSource?: string;
};

/** Grep-friendly audit when an admin should receive a push for chatter shift start. */
function logShiftStartedAdminOutcome(
  options: NotifyOptions,
  outcome: { pushSent: boolean; stage: string; detail?: string }
) {
  if (options.event_type !== "shift_started" || options._triggerSource !== "notifyAdmins") return;
  devLog(NOTIF, "shift_started_admin_outcome", JSON.stringify({
    recipient_user_id: options.user_id,
    entity_id: options.entity_id,
    ...outcome,
  }));
}

/**
 * Main entry: create notification record, then optionally send push based on preferences.
 */
export async function notify(options: NotifyOptions) {
  console.log("[notify] called with user_id:", options.user_id, "event_type:", options.event_type);
  const category = EVENT_TO_CATEGORY[options.event_type];
  const priority = resolveNotifyPriority(options.event_type, options.priority);
  const eventTypeAirtable = EVENT_TYPE_TO_AIRTABLE[options.event_type] ?? options.event_type;
  const preferenceKey = resolvePreferenceKey(
    options.event_type,
    category,
    options.entity_type,
    options._triggerSource
  );

  if (options.event_type === "shift_started") {
    if (options._triggerSource === "notifyAdmins") {
      devLog(NOTIF, "SHIFT_STARTED notifyAdmins_deliver_to_admin", JSON.stringify({
        admin_recipient_user_id: options.user_id,
        entity_id: options.entity_id,
        actor_user_id: options.actor_user_id ?? null,
      }));
    } else {
      devLog(NOTIF, "SHIFT_STARTED notify chatter", JSON.stringify({
        chatter_user_id: options.user_id,
        entity_id: options.entity_id,
        trigger: options._triggerSource ?? "notify",
        actor_user_id: options.actor_user_id ?? null,
      }));
    }
  }

  // 1. When the notification flow starts (this is the exact title/body used for Airtable, push, and realtime)
  devLog(NOTIF, "payload_content", JSON.stringify({
    event_type: options.event_type,
    title: options.title,
    body: options.body,
  }));
  devLog(NOTIF, "1 flow_start", JSON.stringify({
    source_function: options._triggerSource ?? "notify",
    trigger_event: options.event_type,
    actor_user_id: options.actor_user_id ?? null,
    recipient_user_id: options.user_id,
    category,
    event_type: options.event_type,
    priority,
    entity_type: options.entity_type,
    entity_id: options.entity_id,
    title: options.title,
  }));
  devLog(
    PUSH_AUDIT,
    "notify_event_category_pref_key",
    JSON.stringify({
      event_type: options.event_type,
      category,
      preference_key_for_push_gate: preferenceKey,
      note: "push skips if the resolved notification preference column is false in Airtable prefs",
    })
  );

  const airtableCategory = CATEGORY_TO_AIRTABLE[category] ?? category;
  const notification = await createNotification({
    user_id: options.user_id,
    category: airtableCategory,
    event_type: eventTypeAirtable,
    priority,
    title: options.title,
    body: options.body,
    entity_type: options.entity_type,
    entity_id: options.entity_id,
    metadata: options.metadata,
  });

  const unreadCount = await getUnreadCount(options.user_id).catch(() => 0);
  if (notification) {
    // Use options.title/body so realtime/in-app always show exactly what we sent (single source of truth)
    const payload = {
      ...notification,
      title: options.title,
      body: options.body,
      ...(options.metadata?.length ? { metadata: options.metadata } : {}),
    };
    await broadcastRealtimeEvent(
      "user",
      { type: "notification", notification: payload, unreadCount },
      { userId: options.user_id }
    ).catch(() => {});
  }

  if (!notification) {
    devLog(NOTIF, "skip", JSON.stringify({ reason: "invalid payload or Airtable create failed", recipient_user_id: options.user_id }));
    logShiftStartedAdminOutcome(options, { pushSent: false, stage: "no_notification_record", detail: "createNotification returned null" });
    if (isLiveNotificationEvent(options.event_type, options._triggerSource)) {
      devLog(LIVE_NOTIF, "notification_record_created", JSON.stringify({ recipient_user_id: options.user_id, created: false, reason: "createNotification returned null" }));
    }
    logNotifyPushOutcome(options, {
      push_sent: false,
      outcome_stage: "skipped_no_notification_record",
      detail: "createNotification returned null; push not attempted",
    });
    return { notification: null, pushSent: false };
  }

  if (isLiveNotificationEvent(options.event_type, options._triggerSource)) {
    devLog(LIVE_NOTIF, "notification_record_created", JSON.stringify({ recipient_user_id: options.user_id, created: true, notification_id: notification.id }));
  }

  devLog(PUSH_DEBUG, "event entered push decision branch", JSON.stringify({ event_type: options.event_type, recipient_user_id: options.user_id, priority }));

  // 4. Right before loading notification_preferences
  devLog(NOTIF, "4 before_load_preferences", JSON.stringify({ recipient_user_id: options.user_id }));

  const prefs = await getPreferencesByUserId(options.user_id);
  console.log("[notify] user preferences lookup for:", options.user_id);

  devLog(PUSH_DEBUG, "recipient user id", JSON.stringify({ recipient_user_id: options.user_id }));
  devLog(PUSH_DEBUG, "preferences loaded", JSON.stringify({ has_prefs: !!prefs }));
  if (prefs) {
    devLog(PUSH_DEBUG, "push_enabled value", JSON.stringify({ push_enabled: prefs.push_enabled }));
    devLog(PUSH_DEBUG, "mute_all value", JSON.stringify({ mute_all: prefs.mute_all }));
    devLog(PUSH_DEBUG, "critical_only value", JSON.stringify({ critical_only: prefs.critical_only }));
    devLog(PUSH_DEBUG, "event_type and priority being evaluated", JSON.stringify({ event_type: options.event_type, priority, category }));
  }

  // 5. Right after loading notification_preferences
  devLog(NOTIF, "5 after_load_preferences", JSON.stringify({
    recipient_user_id: options.user_id,
    in_app_enabled: prefs?.in_app_enabled ?? null,
    push_enabled: prefs?.push_enabled ?? null,
    mute_all: prefs?.mute_all ?? null,
    critical_only: prefs?.critical_only ?? null,
  }));

  if (prefs) {
    logCategoryPrefKeyReference();
    const prefKey = preferenceKey;
    devLog(
      PUSH_AUDIT,
      "prefs_row_values_for_category_gate",
      JSON.stringify({
        recipient_user_id: options.user_id,
        category,
        preference_key_checked: prefKey,
        value_for_that_key: prefKey != null ? ((prefs as unknown as Record<string, unknown>)[prefKey] ?? null) : null,
        shift_alerts: prefs.shift_alerts,
        model_alerts: prefs.model_alerts,
        whale_alerts: prefs.whale_alerts,
        task_alerts: prefs.task_alerts,
        system_alerts: prefs.system_alerts,
        mistake_alerts: prefs.mistake_alerts,
        fine_bonus_alerts: prefs.fine_bonus_alerts,
        period_alerts: prefs.period_alerts,
        marketing_alerts: prefs.marketing_alerts,
        phase_alerts: prefs.phase_alerts,
        reward_alerts: prefs.reward_alerts,
        push_enabled: prefs.push_enabled,
        mute_all: prefs.mute_all,
        critical_only: prefs.critical_only,
      })
    );
  }

  if (prefs && options.event_type === "shift_started" && options._triggerSource === "notifyAdmins") {
    const pushProbe = shouldSendPush(
      prefs,
      category,
      priority,
      options.event_type,
      options.entity_type,
      options._triggerSource
    );
    devLog(NOTIF, "shift_started_admin_shift_alerts_pref", JSON.stringify({
      recipient_user_id: options.user_id,
      shift_alerts: prefs.shift_alerts,
      push_enabled: prefs.push_enabled,
      mute_all: prefs.mute_all,
      critical_only: prefs.critical_only,
      category,
      maps_to_pref_key: "shift_alerts",
      would_send_push: pushProbe.send,
      skip_reason: pushProbe.skipReason ?? null,
    }));
  }

  if (!prefs) {
    devLog(PUSH_DEBUG, "push skipped with exact reason", JSON.stringify({ reason: "no preferences record", rule: "getPreferencesByUserId returned null", recipient_user_id: options.user_id }));
    devLog(NOTIF, "skip", JSON.stringify({ reason: "no preferences record", recipient_user_id: options.user_id }));
    logShiftStartedAdminOutcome(options, { pushSent: false, stage: "no_preferences_record" });
    if (isLiveNotificationEvent(options.event_type, options._triggerSource)) {
      devLog(LIVE_NOTIF, "push_send_result", JSON.stringify({ recipient_user_id: options.user_id, push_sent: false, reason: "no_preferences_record" }));
    }
    logNotifyPushOutcome(options, {
      push_sent: false,
      outcome_stage: "skipped_no_preferences_row",
      detail: "getPreferencesByUserId returned null; push not attempted",
    });
    return { notification, pushSent: false };
  }

  {
    const now = new Date();
    const inQuiet = isInQuietHours(prefs);
    devLog(
      PUSH_AUDIT,
      "quiet_hours_probe",
      JSON.stringify({
        recipient_user_id: options.user_id,
        iso_utc: now.toISOString(),
        runtime_getHours_getMinutes: `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`,
        runtime_getUTCHours_getUTCMinutes: `${now.getUTCHours()}:${String(now.getUTCMinutes()).padStart(2, "0")}`,
        quiet_hours_start_raw: prefs.quiet_hours_start ?? "",
        quiet_hours_end_raw: prefs.quiet_hours_end ?? "",
        in_quiet_hours: inQuiet,
        note: "isInQuietHours uses getHours/getMinutes (worker local clock, often UTC on Cloudflare)",
      })
    );
  }

  if (isInQuietHours(prefs)) {
    devLog(PUSH_DEBUG, "push skipped with exact reason", JSON.stringify({ reason: "quiet hours", rule: "isInQuietHours(prefs) is true", recipient_user_id: options.user_id }));
    devLog(NOTIF, "skip", JSON.stringify({ reason: "quiet hours", recipient_user_id: options.user_id }));
    logShiftStartedAdminOutcome(options, { pushSent: false, stage: "quiet_hours" });
    if (isLiveNotificationEvent(options.event_type, options._triggerSource)) {
      devLog(LIVE_NOTIF, "push_send_result", JSON.stringify({ recipient_user_id: options.user_id, push_sent: false, reason: "quiet_hours" }));
    }
    logNotifyPushOutcome(options, {
      push_sent: false,
      outcome_stage: "skipped_quiet_hours",
      detail: "isInQuietHours(prefs) true; shouldSendPush not evaluated",
    });
    return { notification, pushSent: false };
  }

  const pushDecision = shouldSendPush(
    prefs,
    category,
    priority,
    options.event_type,
    options.entity_type,
    options._triggerSource
  );
  devLog(
    PUSH_AUDIT,
    "shouldSendPush_evaluation",
    JSON.stringify({
      recipient_user_id: options.user_id,
      category,
      preference_key: preferenceKey,
      send: pushDecision.send,
      skip_reason: pushDecision.skipReason ?? null,
      priority_used: priority,
    })
  );
  if (!pushDecision.send) {
    devLog(PUSH_DEBUG, "push skipped with exact reason", JSON.stringify({ reason: pushDecision.skipReason, rule: pushDecision.skipReason, recipient_user_id: options.user_id }));
    devLog(NOTIF, "skip", JSON.stringify({ reason: pushDecision.skipReason ?? "shouldSendPush false", recipient_user_id: options.user_id }));
    logShiftStartedAdminOutcome(options, { pushSent: false, stage: "push_prefs_blocked", detail: pushDecision.skipReason });
    if (isLiveNotificationEvent(options.event_type, options._triggerSource)) {
      devLog(LIVE_NOTIF, "push_send_result", JSON.stringify({ recipient_user_id: options.user_id, push_sent: false, reason: pushDecision.skipReason ?? "shouldSendPush_false" }));
    }
    logNotifyPushOutcome(options, {
      push_sent: false,
      outcome_stage: "skipped_prefs_shouldSendPush_false",
      detail: pushDecision.skipReason,
    });
    return { notification, pushSent: false };
  }

  // 9. Right before loading push_subscriptions
  devLog(NOTIF, "9 before_load_push_subscriptions", JSON.stringify({ recipient_user_id: options.user_id }));
  devLog("[auth-debug] notification sending", JSON.stringify({
    user_id_used_when_sending_notifications: options.user_id,
    recipient_user_id: options.user_id,
    source: options._triggerSource ?? "notify",
    route: "notification-service.notify",
  }));

  const subscriptions = await getActiveSubscriptionsForUser(options.user_id);

  devLog(PUSH_DEBUG, "subscriptions found count", JSON.stringify({ recipient_user_id: options.user_id, count: subscriptions.length }));

  if (options.event_type === "shift_started") {
    devLog(NOTIF, "shift_started_subscriptions_found", JSON.stringify({
      recipient_user_id: options.user_id,
      trigger: options._triggerSource ?? "notify",
      count: subscriptions.length,
      subscriptions: subscriptions.map((s) => ({
        airtable_record_id: s.id,
        user_id_field: s.user_id,
        subscription_id: s.subscription_id,
        endpoint_preview: s.endpoint?.slice(0, 96),
        role: s.role ?? null,
        created_at: s.created_at,
      })),
    }));
  }

  // 10. Right after loading push_subscriptions
  devLog(NOTIF, "10 after_load_push_subscriptions", JSON.stringify({
    recipient_user_id: options.user_id,
    active_subscriptions_count: subscriptions.length,
  }));

  if (isLiveNotificationEvent(options.event_type, options._triggerSource)) {
    devLog(LIVE_NOTIF, "push_subscription_lookup", JSON.stringify({
      recipient_user_id: options.user_id,
      subscriptions_count: subscriptions.length,
      event_type: options.event_type,
    }));
  }

  if (subscriptions.length === 0) {
    devLog(PUSH_DEBUG, "push skipped with exact reason", JSON.stringify({ reason: "no subscriptions", rule: "getActiveSubscriptionsForUser returned empty array", recipient_user_id: options.user_id }));
    devLog(NOTIF, "skip", JSON.stringify({ reason: "no subscriptions", recipient_user_id: options.user_id }));
    logShiftStartedAdminOutcome(options, { pushSent: false, stage: "no_push_subscriptions" });
    if (isLiveNotificationEvent(options.event_type, options._triggerSource)) {
      devLog(LIVE_NOTIF, "push_send_result", JSON.stringify({ recipient_user_id: options.user_id, push_sent: false, reason: "no_subscriptions" }));
    }
    logNotifyPushOutcome(options, {
      push_sent: false,
      outcome_stage: "skipped_no_push_subscriptions",
      detail: "getActiveSubscriptionsForUser returned empty",
    });
    return { notification, pushSent: false };
  }

  // 11. Right before sending web push
  devLog(NOTIF, "11 before_send_web_push", JSON.stringify({
    recipient_user_id: options.user_id,
    event_type: options.event_type,
    title: options.title,
    subscriptions_count: subscriptions.length,
  }));

  const pushSuccessCount = await sendWebPushToSubscriptionsSequentially(
    subscriptions.map((sub) => ({
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      role: sub.role,
    })),
    { title: options.title, body: options.body, entity_type: options.entity_type },
    options.user_id,
    options.event_type
  );

  if (isLiveNotificationEvent(options.event_type, options._triggerSource)) {
    devLog(LIVE_NOTIF, "push_send_result", JSON.stringify({
      recipient_user_id: options.user_id,
      push_sent: pushSuccessCount > 0,
      push_success_count: pushSuccessCount,
      subscriptions_total: subscriptions.length,
    }));
  }

  const pushSent = pushSuccessCount > 0;
  logShiftStartedAdminOutcome(options, {
    pushSent,
    stage: pushSent ? "web_push_sent" : "web_push_all_failed",
    detail: pushSent ? undefined : `0/${subscriptions.length} subscriptions succeeded`,
  });
  logNotifyPushOutcome(options, {
    push_sent: pushSent,
    outcome_stage: pushSent ? "push_attempted_at_least_one_success" : "push_attempted_all_subscriptions_failed",
    extra: {
      push_success_count: pushSuccessCount,
      subscriptions_tried: subscriptions.length,
    },
  });
  return { notification, pushSent };
}


export type NotifyAdminsOptions = Omit<NotifyOptions, "user_id"> & {
  /** When set, only these user IDs (must each appear in the resolved admin recipient list) receive the notification. */
  onlyUserIds?: string[];
};

export type NotifyAllUsersOptions = Omit<NotifyOptions, "user_id">;

/**
 * Create a notification for EVERY user in the system. Use only when the event truly
 * must be broadcast to all (e.g. system-wide announcement). Do NOT use for operational
 * events (shift, whale, custom, model live, etc.) — use the role-based routing in
 * lib/notification-routing.ts and notifyAdmins / notify(assigned_user) instead.
 */
export async function notifyAllUsers(options: NotifyAllUsersOptions) {
  const users = await listAllUsers();
  devLog(NOTIF, "notifyAllUsers", JSON.stringify({ recipient_count: users.length, event_type: options.event_type }));
  // Sequential (not Promise.all): each notify completes Airtable + push before the next user.
  for (const u of users) {
    if (!u.id) continue;
    await notify({ ...options, user_id: u.id, _triggerSource: "notifyAllUsers" }).catch(() => {});
  }
}

/** Create a notification for each admin recipient (system_settings admin_notification_ids JSON, else ADMIN_AIRTABLE_USER_IDS env). */
export async function notifyAdmins(options: NotifyAdminsOptions) {
  const { onlyUserIds, ...notifyPayload } = options;
  const adminIds = await getAdminNotificationIds();
  logAdminAirtableUserIdsEnv("notifyAdmins", adminIds);
  const targets =
    onlyUserIds && onlyUserIds.length > 0 ? adminIds.filter((id) => onlyUserIds.includes(id)) : adminIds;
  devLog(NOTIF, "admin_recipients", JSON.stringify({ count: targets.length, filtered: !!onlyUserIds?.length }));
  if (isLiveNotificationEvent(notifyPayload.event_type)) {
    devLog(LIVE_NOTIF, "admin_recipient_resolution", JSON.stringify({
      event_type: notifyPayload.event_type,
      admin_user_ids: targets,
      source: "admin_notification_ids_or_ADMIN_AIRTABLE_USER_IDS",
    }));
  }
  if (adminIds.length === 0 || targets.length === 0) {
    devLog(NOTIF, "skip", JSON.stringify({ reason: "no recipient", detail: "admin_notification_ids and ADMIN_AIRTABLE_USER_IDS are empty", recipient_user_ids: [] }));
    if (isLiveNotificationEvent(notifyPayload.event_type)) {
      devLog(LIVE_NOTIF, "admin_notify_skipped", JSON.stringify({ reason: "no admin notification recipient IDs" }));
    }
    devLog(PUSH_AUDIT, "notifyAdmins_skipped", JSON.stringify({ reason: "no admin ids", push_sent_aggregate: false }));
    return;
  }
  devLog(NOTIF, "1 flow_start", JSON.stringify({
    source_function: "notifyAdmins",
    trigger_event: notifyPayload.event_type,
    actor_user_id: notifyPayload.actor_user_id ?? null,
    recipient_user_ids: targets,
    category: EVENT_TO_CATEGORY[notifyPayload.event_type],
    event_type: notifyPayload.event_type,
    priority: resolveNotifyPriority(notifyPayload.event_type, notifyPayload.priority),
    entity_type: notifyPayload.entity_type,
    entity_id: notifyPayload.entity_id,
    title: notifyPayload.title,
  }));
  if (notifyPayload.event_type === "shift_started") {
    devLog(NOTIF, "SHIFT_STARTED notifyAdmins", JSON.stringify({
      admin_ids: targets,
      admin_count: targets.length,
      entity_id: notifyPayload.entity_id,
      actor_user_id: notifyPayload.actor_user_id ?? null,
    }));
  }
  // Sequential (not Promise.all): each admin's notify + pushes finish before the next admin.
  let adminsPushSent = 0;
  let adminsPushNotSent = 0;
  let adminsNotifyErrors = 0;
  for (const user_id of targets) {
    devLog(NOTIF, "notifyAdmins_per_admin_start", JSON.stringify({
      event_type: notifyPayload.event_type,
      recipient_user_id: user_id,
      entity_id: notifyPayload.entity_id,
    }));
    try {
      const result = await notify({ ...notifyPayload, user_id, _triggerSource: "notifyAdmins" });
      if (result.pushSent) adminsPushSent += 1;
      else adminsPushNotSent += 1;
      devLog(NOTIF, "notifyAdmins_per_admin_done", JSON.stringify({
        event_type: notifyPayload.event_type,
        recipient_user_id: user_id,
        pushSent: result.pushSent,
        has_notification: !!result.notification,
      }));
      devLog(
        PUSH_AUDIT,
        "notifyAdmins_per_admin_push_outcome",
        JSON.stringify({
          event_type: notifyPayload.event_type,
          recipient_user_id: user_id,
          push_sent: result.pushSent,
          has_notification: !!result.notification,
          note: "see matching notify_push_outcome for skip reason when push_sent is false",
        })
      );
    } catch (err) {
      adminsNotifyErrors += 1;
      console.error(NOTIF, "notifyAdmins_per_admin_failed", JSON.stringify({
        event_type: notifyPayload.event_type,
        recipient_user_id: user_id,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }
  devLog(
    PUSH_AUDIT,
    "notifyAdmins_batch_summary",
    JSON.stringify({
      event_type: notifyPayload.event_type,
      entity_id: notifyPayload.entity_id,
      admin_recipients: targets.length,
      count_push_sent_true: adminsPushSent,
      count_push_sent_false: adminsPushNotSent,
      notify_threw_errors: adminsNotifyErrors,
    })
  );
}

/** Notify admins only if no notification already exists for this entity+event (for late/no-show dedup). */
export async function notifyAdminsOnce(
  options: NotifyAdminsOptions,
  checkDuplicate: (userId: string) => Promise<boolean>
) {
  const { onlyUserIds: _onlyUserIds, ...notifyOncePayload } = options;
  const adminIds = await getAdminNotificationIds();
  logAdminAirtableUserIdsEnv("notifyAdminsOnce", adminIds);
  if (adminIds.length === 0) {
    devLog(NOTIF, "skip", JSON.stringify({ reason: "no recipient", detail: "admin_notification_ids and ADMIN_AIRTABLE_USER_IDS are empty", recipient_user_ids: [] }));
    devLog(PUSH_AUDIT, "notifyAdminsOnce_skipped", JSON.stringify({ reason: "no admin ids", push_sent_aggregate: false }));
    return;
  }
  devLog(NOTIF, "1 flow_start", JSON.stringify({
    source_function: "notifyAdminsOnce",
    trigger_event: options.event_type,
    actor_user_id: options.actor_user_id ?? null,
    recipient_user_ids: adminIds,
    category: EVENT_TO_CATEGORY[options.event_type],
    event_type: options.event_type,
    priority: resolveNotifyPriority(options.event_type, options.priority),
    entity_type: options.entity_type,
    entity_id: options.entity_id,
    title: options.title,
  }));
  let oncePushSent = 0;
  let oncePushNotSent = 0;
  let onceSkippedDuplicate = 0;
  // Sequential (not Promise.all): one admin at a time.
  for (const user_id of adminIds) {
    // 2. Right before duplicate-prevention logic
    devLog(NOTIF, "2 before_duplicate_check", JSON.stringify({
      recipient_user_id: user_id,
      event_type: options.event_type,
      entity_type: options.entity_type,
      entity_id: options.entity_id,
    }));
    const exists = await checkDuplicate(user_id).catch(() => true);
    // 3. Right after duplicate-prevention logic
    if (exists) {
      onceSkippedDuplicate += 1;
      devLog(NOTIF, "3 after_duplicate_check", JSON.stringify({ duplicate_found: true, skipped: true, recipient_user_id: user_id }));
      devLog(NOTIF, "skip", JSON.stringify({ reason: "duplicate prevented", recipient_user_id: user_id, event_type: options.event_type }));
      devLog(
        PUSH_AUDIT,
        "notifyAdminsOnce_per_admin_skipped_duplicate",
        JSON.stringify({ recipient_user_id: user_id, event_type: options.event_type, push_not_attempted: true })
      );
      continue;
    }
    devLog(NOTIF, "3 after_duplicate_check", JSON.stringify({ duplicate_found: false, continue: true, recipient_user_id: user_id }));
    try {
      const onceResult = await notify({ ...notifyOncePayload, user_id, _triggerSource: "notifyAdminsOnce" });
      if (onceResult.pushSent) oncePushSent += 1;
      else oncePushNotSent += 1;
      devLog(
        PUSH_AUDIT,
        "notifyAdminsOnce_per_admin_push_outcome",
        JSON.stringify({
          recipient_user_id: user_id,
          event_type: options.event_type,
          push_sent: onceResult.pushSent,
          has_notification: !!onceResult.notification,
        })
      );
    } catch {
      oncePushNotSent += 1;
    }
  }
  devLog(
    PUSH_AUDIT,
    "notifyAdminsOnce_batch_summary",
    JSON.stringify({
      event_type: options.event_type,
      entity_id: options.entity_id,
      admin_recipients: adminIds.length,
      skipped_duplicate: onceSkippedDuplicate,
      count_push_sent_true: oncePushSent,
      count_push_sent_false: oncePushNotSent,
    })
  );
}
