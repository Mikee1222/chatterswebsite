/**
 * ClarioSuite outage tracking — first-failure timestamp, data-as-of,
 * and a single admin notify after the outage exceeds 3 hours.
 */

import {
  formatClarioSuiteOutageStatus,
  formatClarioSuiteUserMessage,
  isClarioSuiteTransientHttpStatus,
  isClarioSuiteUpstreamGenericMessage,
  ClarioSuiteApiError,
} from "@/lib/clariosuite-api";
import {
  NOTIFICATION_ENTITY,
  NOTIFICATION_EVENT,
  NOTIFICATION_PRIORITY,
} from "@/lib/notification-types";
import { EVENT_TYPE_TO_AIRTABLE } from "@/lib/notifications-schema";
import { getSystemSetting, setSystemSetting } from "@/services/system-settings";
import { notifyAdminsOnce } from "@/services/notification-service";
import { findExistingNotification } from "@/services/notifications";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

export const CLARIOSUITE_OUTAGE_SETTING_KEY = "clariosuite_outage_state";
/** Notify admins only after this many hours of continuous outage. */
export const CLARIOSUITE_OUTAGE_NOTIFY_AFTER_MS = 3 * 60 * 60 * 1000;

export type ClarioSuiteOutageState = {
  startedAt: string;
  lastFailedAt: string;
  lastError: string;
  lastNotifiedAt: string | null;
  lastPath?: string | null;
  lastStatus?: number | null;
};

export function parseClarioSuiteOutageState(raw: string | null): ClarioSuiteOutageState | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ClarioSuiteOutageState>;
    if (typeof parsed.startedAt !== "string" || !parsed.startedAt.trim()) return null;
    if (typeof parsed.lastFailedAt !== "string" || !parsed.lastFailedAt.trim()) return null;
    return {
      startedAt: parsed.startedAt,
      lastFailedAt: parsed.lastFailedAt,
      lastError: typeof parsed.lastError === "string" ? parsed.lastError : "ClarioSuite unavailable",
      lastNotifiedAt:
        typeof parsed.lastNotifiedAt === "string" && parsed.lastNotifiedAt.trim()
          ? parsed.lastNotifiedAt
          : null,
      lastPath: typeof parsed.lastPath === "string" ? parsed.lastPath : null,
      lastStatus: typeof parsed.lastStatus === "number" ? parsed.lastStatus : null,
    };
  } catch {
    return null;
  }
}

/** Pure gate: notify once after continuous outage exceeds the threshold. */
export function shouldNotifyClarioSuiteOutage(
  state: ClarioSuiteOutageState,
  nowMs = Date.now(),
  thresholdMs = CLARIOSUITE_OUTAGE_NOTIFY_AFTER_MS
): boolean {
  const started = Date.parse(state.startedAt);
  if (!Number.isFinite(started)) return false;
  if (nowMs - started < thresholdMs) return false;
  if (!state.lastNotifiedAt) return true;
  const notified = Date.parse(state.lastNotifiedAt);
  // Already notified for this outage window (notified at/after outage start).
  if (Number.isFinite(notified) && notified >= started) return false;
  return true;
}

export function isClarioSuiteUpstreamOutageError(err: unknown): boolean {
  if (err instanceof ClarioSuiteApiError) {
    if (err.code === "network_error") return true;
    if (isClarioSuiteTransientHttpStatus(err.status)) return true;
    if (isClarioSuiteUpstreamGenericMessage(err.message)) return true;
    return false;
  }
  if (err instanceof Error) {
    return (
      isClarioSuiteUpstreamGenericMessage(err.message) ||
      /temporarily unavailable|fetch failed|network|ECONNRESET|ETIMEDOUT|ENOTFOUND/i.test(
        err.message
      )
    );
  }
  return false;
}

export async function getClarioSuiteOutageState(): Promise<ClarioSuiteOutageState | null> {
  const raw = await getSystemSetting(CLARIOSUITE_OUTAGE_SETTING_KEY);
  return parseClarioSuiteOutageState(raw);
}

export async function clearClarioSuiteOutage(): Promise<void> {
  await setSystemSetting(
    CLARIOSUITE_OUTAGE_SETTING_KEY,
    "",
    "ClarioSuite outage cleared — API recovered"
  );
}

export async function recordClarioSuiteOutage(err: unknown): Promise<ClarioSuiteOutageState> {
  const now = new Date().toISOString();
  const existing = await getClarioSuiteOutageState();
  const message = formatClarioSuiteUserMessage(err);
  const next: ClarioSuiteOutageState = {
    startedAt: existing?.startedAt ?? now,
    lastFailedAt: now,
    lastError: message,
    lastNotifiedAt: existing?.lastNotifiedAt ?? null,
    lastPath: err instanceof ClarioSuiteApiError ? err.path || null : null,
    lastStatus: err instanceof ClarioSuiteApiError ? err.status || null : null,
  };
  await setSystemSetting(
    CLARIOSUITE_OUTAGE_SETTING_KEY,
    JSON.stringify(next),
    "ClarioSuite upstream outage tracking (startedAt / lastNotifiedAt)"
  );
  return next;
}

export async function markClarioSuiteOutageNotified(
  state: ClarioSuiteOutageState
): Promise<ClarioSuiteOutageState> {
  const next: ClarioSuiteOutageState = {
    ...state,
    lastNotifiedAt: new Date().toISOString(),
  };
  await setSystemSetting(
    CLARIOSUITE_OUTAGE_SETTING_KEY,
    JSON.stringify(next),
    "ClarioSuite upstream outage tracking (startedAt / lastNotifiedAt)"
  );
  return next;
}

export async function getClarioSuiteDataAsOfIso(): Promise<string | null> {
  try {
    const sb = getSupabaseServiceClient();
    const { data, error } = await sb
      .from("clariosuite_daily_insights")
      .select("synced_at")
      .not("synced_at", "is", null)
      .order("synced_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const v = (data as { synced_at?: unknown }).synced_at;
    return typeof v === "string" && v.trim() ? v : null;
  } catch {
    return null;
  }
}

export async function buildClarioSuiteOutageMessage(
  state?: ClarioSuiteOutageState | null
): Promise<string> {
  const outage = state ?? (await getClarioSuiteOutageState());
  const dataAsOf = await getClarioSuiteDataAsOfIso();
  return formatClarioSuiteOutageStatus({
    sinceIso: outage?.startedAt ?? null,
    dataAsOfIso: dataAsOf,
  });
}

/**
 * Notify admins once if outage has lasted >3h. Returns true when a notify was attempted.
 * Uses existing integration_sync_failed (system_alerts) — no new event type.
 */
export async function maybeNotifyClarioSuiteOutage(
  state: ClarioSuiteOutageState
): Promise<{ notified: boolean; reason: string }> {
  if (!shouldNotifyClarioSuiteOutage(state)) {
    const started = Date.parse(state.startedAt);
    const ageH = Number.isFinite(started)
      ? ((Date.now() - started) / (1000 * 60 * 60)).toFixed(1)
      : "?";
    if (state.lastNotifiedAt) {
      return { notified: false, reason: `already_notified_for_this_outage (age ${ageH}h)` };
    }
    return { notified: false, reason: `outage_under_3h (age ${ageH}h)` };
  }

  const dataAsOf = await getClarioSuiteDataAsOfIso();
  const body = formatClarioSuiteOutageStatus({
    sinceIso: state.startedAt,
    dataAsOfIso: dataAsOf,
  });
  // Stable entity id for this outage window so notifyAdminsOnce dedupes if called twice.
  const dedupeId = `integration-sync-clariosuite-outage-${state.startedAt.slice(0, 16)}`;
  const event = NOTIFICATION_EVENT.INTEGRATION_SYNC_FAILED;

  await notifyAdminsOnce(
    {
      event_type: event,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: "clariosuite: prolonged outage",
      body: body.slice(0, 400),
      entity_type: NOTIFICATION_ENTITY.INTEGRATION,
      entity_id: dedupeId,
      actor_name: "Integration Health",
    },
    (userId) =>
      findExistingNotification(
        userId,
        NOTIFICATION_ENTITY.INTEGRATION,
        dedupeId,
        EVENT_TYPE_TO_AIRTABLE[event] ?? event
      )
  ).catch((err) => console.error("[clariosuite-outage] notify failed", err));

  await markClarioSuiteOutageNotified(state);
  return { notified: true, reason: "notified_after_3h" };
}
