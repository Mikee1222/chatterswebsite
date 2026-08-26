"use server";

import { athensYmdStartUtcMs, getTodayYmdAthens } from "@/lib/airtable-datetime";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { findExistingNotification, listNotificationsForUser } from "@/services/notifications";
import { getPreferencesByUserId } from "@/services/notification-preferences";
import { notify } from "@/services/notification-service";
import { listActiveUsers } from "@/services/users";
import { generateNotificationDigestText } from "@/services/ai-powered-features";

const AIRTABLE_SYSTEM_ALERT = "system_alert";

export type AiNotificationDigestCronResult = {
  ok: true;
  ymd: string;
  candidates: number;
  notifications_sent: number;
  skipped_opt_out: number;
  skipped_duplicates: number;
  skipped_empty: number;
  errors: number;
};

/**
 * Evening digest: users who explicitly opted in via event_overrides.ai_notification_digest === true.
 */
export async function runAiNotificationDigest(): Promise<AiNotificationDigestCronResult> {
  const ymd = getTodayYmdAthens();
  const sinceIso = new Date(athensYmdStartUtcMs(ymd)).toISOString();
  const entityId = `ai_notification_digest:${ymd}`;

  const users = await listActiveUsers().catch(() => []);
  let notifications_sent = 0;
  let skipped_opt_out = 0;
  let skipped_duplicates = 0;
  let skipped_empty = 0;
  let errors = 0;
  let candidates = 0;

  for (const user of users) {
    const userId = user.id?.trim();
    if (!userId) continue;

    const prefs = await getPreferencesByUserId(userId).catch(() => null);
    if (prefs?.event_overrides?.ai_notification_digest !== true) {
      skipped_opt_out += 1;
      continue;
    }
    candidates += 1;

    const dup = await findExistingNotification(
      userId,
      "system",
      entityId,
      AIRTABLE_SYSTEM_ALERT,
    ).catch(() => true);
    if (dup) {
      skipped_duplicates += 1;
      continue;
    }

    try {
      const { notifications } = await listNotificationsForUser(userId, {
        pageSize: 80,
        since: sinceIso,
      });
      const digestSource = notifications.filter(
        (n) => n.event_type !== NOTIFICATION_EVENT.AI_NOTIFICATION_DIGEST,
      );
      if (digestSource.length === 0) {
        skipped_empty += 1;
        continue;
      }

      const text = await generateNotificationDigestText({
        userId,
        ymd,
        notifications: digestSource.map((n) => ({
          title: n.title,
          body: n.body,
          event_type: n.event_type,
          created_at: n.created_at,
        })),
      });

      await notify({
        user_id: userId,
        event_type: NOTIFICATION_EVENT.AI_NOTIFICATION_DIGEST,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: "✨ Your AI notification digest",
        body: text,
        entity_type: "system",
        entity_id: entityId,
        _triggerSource: "ai_notification_digest_cron",
      });
      notifications_sent += 1;
    } catch (err) {
      errors += 1;
      console.error("[ai-notification-digest] user failed", userId, err);
    }
  }

  return {
    ok: true,
    ymd,
    candidates,
    notifications_sent,
    skipped_opt_out,
    skipped_duplicates,
    skipped_empty,
    errors,
  };
}
