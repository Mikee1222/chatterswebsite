/**
 * Notify admins when fraud anomaly flags are detected (deduped per flag + window).
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { PERMISSIONS } from "@/lib/permissions";
import { notify } from "@/services/notification-service";
import { listUsersWithPermission } from "@/services/users";
import {
  attachExplanationsToFlags,
  runFraudAnomalyDetection,
} from "@/services/ai-ops-features";

export type FraudAlertRunResult = {
  ok: true;
  flags: number;
  notifications_sent: number;
};

export async function runFraudAnomalyAlerts(): Promise<FraudAlertRunResult> {
  const result = await runFraudAnomalyDetection({ force: false });
  const flags = attachExplanationsToFlags(result.scan.flags, result.explanations).filter(
    (f) => f.severity === "critical" || f.severity === "warn",
  );
  if (flags.length === 0) {
    return { ok: true, flags: 0, notifications_sent: 0 };
  }

  const managers = await listUsersWithPermission(PERMISSIONS.EARNINGS_VIEW).catch(() => []);
  if (managers.length === 0) {
    return { ok: true, flags: flags.length, notifications_sent: 0 };
  }

  const sb = getSupabaseServiceClient();
  const bucket = `${result.scan.startYmd}:${result.scan.endYmd}`;
  let notifications_sent = 0;

  for (const flag of flags.slice(0, 15)) {
    const entityId = `fraud:${flag.id}:${bucket}`;
    const body =
      flag.ai_explanation ||
      flag.evidence.slice(0, 2).join(" ") ||
      flag.title;

    for (const user of managers) {
      if (!user.id) continue;
      const { data: existing } = await sb
        .from("notifications")
        .select("id")
        .eq("user_id", user.id)
        .eq("entity_id", entityId)
        .eq("event_type", NOTIFICATION_EVENT.FRAUD_ANOMALY_DETECTED)
        .limit(1)
        .maybeSingle();
      if (existing) continue;

      await notify({
        user_id: user.id,
        event_type: NOTIFICATION_EVENT.FRAUD_ANOMALY_DETECTED,
        priority:
          flag.severity === "critical"
            ? NOTIFICATION_PRIORITY.HIGH
            : NOTIFICATION_PRIORITY.NORMAL,
        title: flag.title,
        body: body.slice(0, 400),
        entity_type: NOTIFICATION_ENTITY.FRAUD_ANOMALY,
        entity_id: entityId,
        _triggerSource: "ai_fraud_anomaly_scan",
      }).catch(() => {});
      notifications_sent += 1;
    }
  }

  return { ok: true, flags: flags.length, notifications_sent };
}

/**
 * Admin-only wellbeing check-in notifications (never to the person themselves).
 */
export async function runWellbeingCheckinAlerts(): Promise<{
  ok: true;
  signals: number;
  notifications_sent: number;
}> {
  const { generateWellbeingEarlyWarnings } = await import("@/services/ai-ops-features");
  const result = await generateWellbeingEarlyWarnings({ force: false });
  if (result.signals.length === 0) {
    return { ok: true, signals: 0, notifications_sent: 0 };
  }

  const managers = await listUsersWithPermission(PERMISSIONS.MISTAKES_VIEW).catch(() => []);
  const admins = managers.filter((u) => {
    const role = (u.role ?? "").toLowerCase();
    return role === "admin" || role === "manager";
  });
  if (admins.length === 0) {
    return { ok: true, signals: result.signals.length, notifications_sent: 0 };
  }

  const sb = getSupabaseServiceClient();
  const today = result.generated_at.slice(0, 10);
  let notifications_sent = 0;

  for (const signal of result.signals) {
    const entityId = `wellbeing:${signal.person_id}:${today}`;

    for (const user of admins) {
      if (!user.id) continue;
      // Never notify the person the signal is about
      if (
        user.id === signal.person_id ||
        user.user_id === signal.person_id
      ) {
        continue;
      }
      const { data: existing } = await sb
        .from("notifications")
        .select("id")
        .eq("user_id", user.id)
        .eq("entity_id", entityId)
        .eq("event_type", NOTIFICATION_EVENT.WELLBEING_CHECKIN_SUGGESTED)
        .limit(1)
        .maybeSingle();
      if (existing) continue;

      await notify({
        user_id: user.id,
        event_type: NOTIFICATION_EVENT.WELLBEING_CHECKIN_SUGGESTED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: `Check-in suggested: ${signal.person_name}`,
        body: `${signal.headline} — ${signal.evidence.slice(0, 2).join("; ")}`.slice(0, 400),
        entity_type: NOTIFICATION_ENTITY.WELLBEING_SIGNAL,
        entity_id: entityId,
        _triggerSource: "ai_wellbeing_scan",
      }).catch(() => {});
      notifications_sent += 1;
    }
  }

  return { ok: true, signals: result.signals.length, notifications_sent };
}
