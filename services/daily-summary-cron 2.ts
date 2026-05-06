"use server";

import type { Shift } from "@/types";
import { formatSummaryTitleDate, whaleCreatedBoundsForYmdGmtPlus3 } from "@/lib/daily-summary-gmt3";
import { getYesterdayYmdAthens } from "@/lib/airtable-datetime";
import { getShiftsForDate, listShiftModelsForShifts } from "@/services/shifts";
import { listAllWhaleTransactions } from "@/services/whale-transactions";
import { countCustomRequestsPendingOrInProgress } from "@/services/custom-requests";
import { findExistingNotification } from "@/services/notifications";
import { notifyAdmins } from "@/services/notification-service";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

function workedMinutesForShift(s: Shift): number {
  if (typeof s.worked_minutes === "number" && s.worked_minutes > 0) return s.worked_minutes;
  if (typeof s.total_minutes === "number" && s.total_minutes > 0) return s.total_minutes;
  if (s.start_time && s.end_time) {
    const a = new Date(s.start_time).getTime();
    const b = new Date(s.end_time).getTime();
    if (!Number.isNaN(a) && !Number.isNaN(b) && b > a) return Math.round((b - a) / 60000);
  }
  return 0;
}

function adminUserIdsFromEnv(): string[] {
  const raw = process.env.ADMIN_AIRTABLE_USER_IDS;
  if (!raw || typeof raw !== "string") return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

const AIRTABLE_SYSTEM_ALERT = "system_alert";

export type DailySummaryCronResult = {
  ok: true;
  date_gmt3: string;
  notifications_sent: number;
  skipped_all_duplicates: boolean;
  shift_count: number;
  total_hours: string;
  model_count: number;
  whale_total: string;
  whale_tx_count: number;
  pending_customs: number;
};

/**
 * Aggregates yesterday (full calendar day GMT+3) and sends one in-app notification per admin
 * (dedup entity_id `daily_summary:${ymd}`).
 */
export async function runDailySummaryNotifications(): Promise<DailySummaryCronResult> {
  const ymd = getYesterdayYmdAthens();
  const dateLabel = formatSummaryTitleDate(ymd);
  const entityId = `daily_summary:${ymd}`;

  const shifts = await getShiftsForDate(ymd);
  const completed = shifts.filter((s) => s.status === "completed");
  const shiftCount = completed.length;
  const totalMinutes = completed.reduce((acc, s) => acc + workedMinutesForShift(s), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  const shiftIds = completed.map((s) => s.id);
  const shiftModels = await listShiftModelsForShifts(shiftIds);
  const modelNamesSet = new Set<string>();
  for (const sm of shiftModels) {
    const name = (sm.model_name ?? "").trim();
    if (name) modelNamesSet.add(name);
  }
  const modelNames = modelNamesSet.size ? [...modelNamesSet].sort().join(", ") : "None";

  const pendingCustoms = await countCustomRequestsPendingOrInProgress();

  const { startMs, endMs } = whaleCreatedBoundsForYmdGmtPlus3(ymd);
  const allTx = await listAllWhaleTransactions();
  const txsYesterday = allTx.filter((t) => {
    const ms = new Date(t.created_at).getTime();
    return Number.isFinite(ms) && ms >= startMs && ms <= endMs;
  });
  const whaleTxCount = txsYesterday.length;
  const whaleSum = txsYesterday.reduce((acc, t) => acc + (typeof t.amount === "number" ? t.amount : 0), 0);
  const whaleTotal = whaleSum.toFixed(2);

  const body = `${shiftCount} shifts · ${totalHours}h worked
Models active: ${modelNames}
Whale revenue: €${whaleTotal}
Pending customs: ${pendingCustoms}`;

  const adminIds = adminUserIdsFromEnv();
  const needing: string[] = [];
  for (const id of adminIds) {
    const dup = await findExistingNotification(id, "system", entityId, AIRTABLE_SYSTEM_ALERT).catch(() => true);
    if (!dup) needing.push(id);
  }

  let notifications_sent = 0;
  if (needing.length > 0) {
    await notifyAdmins({
      event_type: NOTIFICATION_EVENT.DAILY_SUMMARY,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: `📊 Daily Summary — ${dateLabel}`,
      body,
      entity_type: "system",
      entity_id: entityId,
      onlyUserIds: needing,
    });
    notifications_sent = needing.length;
  }

  return {
    ok: true,
    date_gmt3: ymd,
    notifications_sent,
    skipped_all_duplicates: needing.length === 0 && adminIds.length > 0,
    shift_count: shiftCount,
    total_hours: totalHours,
    model_count: modelNamesSet.size,
    whale_total: whaleTotal,
    whale_tx_count: whaleTxCount,
    pending_customs: pendingCustoms,
  };
}
