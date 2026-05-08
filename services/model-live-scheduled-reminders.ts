"use server";

import { EVENT_TYPE_TO_AIRTABLE } from "@/lib/notifications-schema";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { findExistingNotification } from "@/services/notifications";
import { notify } from "@/services/notification-service";
import { listAllModelLiveStreamsInRange } from "@/services/model-live-streams";
import { getActiveModelUserAirtableIdByLinkedModelRecordId } from "@/services/users";
import type { ModelLiveStreamRecord } from "@/types";

/** Match shift “starting soon” cron window: scheduled start in ~30–45 minutes. */
const REMINDER_MIN_MS = 30 * 60 * 1000;
const REMINDER_MAX_MS = 45 * 60 * 1000;

function scheduledStartMs(stream: ModelLiveStreamRecord): number | null {
  const date = stream.date?.trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const ps = stream.planned_start?.trim();
  if (!ps) {
    const noon = Date.parse(`${date}T12:00:00.000Z`);
    return Number.isFinite(noon) ? noon : null;
  }
  if (ps.includes("T")) {
    const ms = new Date(ps).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  const timePart = ps.length === 5 ? `${ps}:00` : ps.slice(0, 8);
  const localMs = Date.parse(`${date}T${timePart}`);
  if (Number.isFinite(localMs)) return localMs;
  const zMs = Date.parse(`${date}T${timePart}Z`);
  return Number.isFinite(zMs) ? zMs : null;
}

function isScheduledForReminder(stream: ModelLiveStreamRecord): boolean {
  if (stream.actual_start?.trim()) return false;
  const st = (stream.status ?? "").trim().toLowerCase();
  if (st === "live" || st === "in_progress") return false;
  if (st.includes("complete") || st.includes("cancel") || st.includes("miss")) return false;
  return true;
}

export type ModelLiveScheduledRemindersResult = {
  ok: true;
  scanned: number;
  sent: number;
};

/**
 * Notify linked model users ~30–45 minutes before planned live start.
 * Deduped per stream via notifications (entity_id `model_live_scheduled_reminder:{streamId}`).
 */
export async function runModelLiveScheduledReminders(): Promise<ModelLiveScheduledRemindersResult> {
  const streams = await listAllModelLiveStreamsInRange({});
  const now = Date.now();
  let sent = 0;
  const eventAirtable =
    EVENT_TYPE_TO_AIRTABLE[NOTIFICATION_EVENT.MODEL_LIVE_SCHEDULED] ?? "model_became_free";

  for (const s of streams) {
    if (!isScheduledForReminder(s)) continue;
    const startMs = scheduledStartMs(s);
    if (startMs == null) continue;
    const delta = startMs - now;
    if (delta < REMINDER_MIN_MS || delta > REMINDER_MAX_MS) continue;

    const modelUserId = await getActiveModelUserAirtableIdByLinkedModelRecordId(s.model_id);
    const uid = modelUserId?.trim();
    if (!uid) continue;

    const entityId = `model_live_scheduled_reminder:${s.id}`;
    const dup = await findExistingNotification(uid, "model_live_stream", entityId, eventAirtable).catch(() => true);
    if (dup) continue;

    await notify({
      user_id: uid,
      event_type: NOTIFICATION_EVENT.MODEL_LIVE_SCHEDULED,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: "🎥 Live stream starting soon",
      body: "Your scheduled live stream starts in 30 minutes. Get ready!",
      entity_type: "model_live_stream",
      entity_id: entityId,
      _triggerSource: "model_live_scheduled_reminder_cron",
    }).catch(() => {});
    sent++;
  }

  return { ok: true, scanned: streams.length, sent };
}
