/**
 * After Infloww sync: notify infloww_stats:view_all holders of high-value
 * dashboard alert conditions. Dedupes per alert id + period bucket (like
 * material_until_approaching) so hourly/daily re-syncs do not spam.
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { PERMISSIONS } from "@/lib/permissions";
import { previousPeriodRange } from "@/services/infloww-analytics";
import { buildAgencyCreatorAnalytics } from "@/services/infloww-creator-analytics";
import {
  listCreatorDailyStats,
  listCreatorRefunds,
  listCreatorTransactions,
  listLinkedCreatorModels,
  listMarketingLinks,
  listPriorityMassMessages,
} from "@/services/infloww-creator-earnings";
import {
  getAdminInflowwPerformanceReport,
  resolveInflowwStatsRange,
} from "@/services/infloww-performance";
import { notify } from "@/services/notification-service";
import { listUsersWithPermission } from "@/services/users";

export type InflowwPerformanceAlertsResult = {
  ok: true;
  alerts_considered: number;
  notifications_sent: number;
};

function isHighValueAlertId(id: string): boolean {
  return (
    id.startsWith("sales-drop-") ||
    id.startsWith("refund-critical-") ||
    id.startsWith("refund-warn-") ||
    id.startsWith("churn-")
  );
}

/**
 * Cron: fire infloww_performance_alert for declining chatter WoW, high refund
 * rate, and model churn at-risk. Dedup via entity_id
 * `infloww_alert:{alertId}:{bucket}` (week for chatter/churn, month for refunds).
 */
export async function runInflowwPerformanceAlerts(): Promise<InflowwPerformanceAlertsResult> {
  const sb = getSupabaseServiceClient();
  const managers = await listUsersWithPermission(PERMISSIONS.INFLOWW_STATS_VIEW_ALL).catch(() => []);
  if (managers.length === 0) {
    return { ok: true, alerts_considered: 0, notifications_sent: 0 };
  }

  const weekRange = resolveInflowwStatsRange("this_week");
  const monthRange = resolveInflowwStatsRange("this_month");
  const weekBucket = weekRange.startYmd;
  const monthBucket = monthRange.startYmd;

  const chatterReport = await getAdminInflowwPerformanceReport(weekRange, {
    includeRoi: false,
  }).catch((err) => {
    console.error("[infloww-performance-alerts] chatter report failed", err);
    return null;
  });

  const chatterAlerts = (chatterReport?.alerts ?? []).filter(
    (a) => a.id.startsWith("sales-drop-") && isHighValueAlertId(a.id)
  );

  let creatorAlerts: Array<{ id: string; severity: string; title: string; detail: string }> = [];
  try {
    const prev = previousPeriodRange(monthRange.startYmd, monthRange.endYmd);
    const [{ linked }, daily, transactions, refunds, marketingLinks, pmm, prevTxs] =
      await Promise.all([
        listLinkedCreatorModels(),
        listCreatorDailyStats({
          startYmd: monthRange.startYmd,
          endYmd: monthRange.endYmd,
        }),
        listCreatorTransactions({
          startYmd: monthRange.startYmd,
          endYmd: monthRange.endYmd,
          fetchAll: true,
          revenueOnly: true,
        }),
        listCreatorRefunds({
          startYmd: monthRange.startYmd,
          endYmd: monthRange.endYmd,
          limit: 500,
        }),
        listMarketingLinks({}),
        listPriorityMassMessages({
          startYmd: monthRange.startYmd,
          endYmd: monthRange.endYmd,
          limit: 500,
        }),
        listCreatorTransactions({
          startYmd: prev.startYmd,
          endYmd: prev.endYmd,
          fetchAll: true,
          revenueOnly: true,
        }),
      ]);

    const previousGrossByCreator = new Map<string, number>();
    for (const t of prevTxs) {
      previousGrossByCreator.set(
        t.creator_infloww_id,
        (previousGrossByCreator.get(t.creator_infloww_id) ?? 0) + t.amount
      );
    }

    const agency = buildAgencyCreatorAnalytics({
      linked: linked.map((l) => ({
        creatorInflowwId: l.creatorInflowwId,
        modelRecordId: l.modelRecordId,
        modelName: l.modelName,
      })),
      daily,
      transactions,
      refunds,
      marketingLinks,
      priorityMassMessages: pmm,
      previousGrossByCreator,
    });

    creatorAlerts = agency.alerts.filter((a) => isHighValueAlertId(a.id));
  } catch (err) {
    console.error("[infloww-performance-alerts] creator alerts failed", err);
  }

  type Pending = {
    alertId: string;
    bucket: string;
    severity: "critical" | "warning" | "info" | string;
    title: string;
    detail: string;
  };

  const pending: Pending[] = [
    ...chatterAlerts.map((a) => ({
      alertId: a.id,
      bucket: weekBucket,
      severity: a.severity,
      title: a.title,
      detail: a.detail,
    })),
    ...creatorAlerts.map((a) => ({
      alertId: a.id,
      bucket: a.id.startsWith("churn-") ? weekBucket : monthBucket,
      severity: a.severity,
      title: a.title,
      detail: a.detail,
    })),
  ];

  let notifications_sent = 0;
  for (const alert of pending) {
    const alertEntityId = `infloww_alert:${alert.alertId}:${alert.bucket}`;
    const priority =
      alert.severity === "critical"
        ? NOTIFICATION_PRIORITY.CRITICAL
        : alert.severity === "warning"
          ? NOTIFICATION_PRIORITY.HIGH
          : NOTIFICATION_PRIORITY.NORMAL;

    for (const u of managers) {
      if (!u.id) continue;
      const { data: existing } = await sb
        .from("notifications")
        .select("id")
        .eq("user_id", u.id)
        .eq("entity_id", alertEntityId)
        .eq("event_type", NOTIFICATION_EVENT.INFLOWW_PERFORMANCE_ALERT)
        .limit(1)
        .maybeSingle();
      if (existing) continue;

      await notify({
        user_id: u.id,
        event_type: NOTIFICATION_EVENT.INFLOWW_PERFORMANCE_ALERT,
        priority,
        title: `📊 ${alert.title}`,
        body: alert.detail,
        entity_type: NOTIFICATION_ENTITY.INFLOWW_PERFORMANCE,
        entity_id: alertEntityId,
        _triggerSource: "infloww_performance_alerts_cron",
      }).catch(() => {});
      notifications_sent++;
    }
  }

  return {
    ok: true,
    alerts_considered: pending.length,
    notifications_sent,
  };
}
