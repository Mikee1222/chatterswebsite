"use server";

import { formatSummaryTitleDate } from "@/lib/daily-summary-gmt3";
import { addDaysAthensYmd, getTodayYmdAthens } from "@/lib/airtable-datetime";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { PERMISSIONS } from "@/lib/permissions";
import { findExistingNotification } from "@/services/notifications";
import { notify } from "@/services/notification-service";
import { listUsersWithPermission } from "@/services/users";
import { computeVaStatisticsReport, resolveVaStatisticsRange } from "@/services/va-statistics";

const AIRTABLE_SYSTEM_ALERT = "system_alert";

export type VaStatisticsWeeklyCronResult = {
  ok: true;
  range_start: string;
  range_end: string;
  notifications_sent: number;
  skipped_all_duplicates: boolean;
  team_completion_rate: number | null;
  vas_below_70_pct: number;
  no_shows: number;
  hours: number;
};

/**
 * Monday morning digest: previous Mon–Sun VA team performance for users with va_statistics:view.
 */
export async function runVaStatisticsWeeklySummary(): Promise<VaStatisticsWeeklyCronResult> {
  const today = getTodayYmdAthens();
  // Prefer last full calendar week (Mon–Sun). On Mondays this is the week just completed.
  const range = resolveVaStatisticsRange("last_week");
  // If somehow last_week end is after today (edge), clamp to yesterday.
  const endYmd = range.endYmd > addDaysAthensYmd(today, -1) ? addDaysAthensYmd(today, -1) : range.endYmd;
  const startYmd = range.startYmd;
  const report = await computeVaStatisticsReport({
    startYmd,
    endYmd,
    preset: "custom",
  });

  const dateLabel = `${formatSummaryTitleDate(startYmd)} – ${formatSummaryTitleDate(endYmd)}`;
  const entityId = `va_statistics_weekly:${startYmd}_${endYmd}`;
  const completion =
    report.team.tasks.completion_rate != null ? `${report.team.tasks.completion_rate}%` : "n/a";
  const body = `📊 Team completion rate: ${completion}
👥 ${report.team.va_count} VAs with activity · ${report.team.vas_below_70_pct} below 70%
⏱ ${report.team.shifts.total_hours}h worked · ${report.team.shifts.no_shows} no-shows
Open VA Statistics for coaching details.`;

  const recipients = await listUsersWithPermission(PERMISSIONS.VA_STATISTICS_VIEW);
  const needing: string[] = [];
  for (const u of recipients) {
    const dup = await findExistingNotification(u.id, "system", entityId, AIRTABLE_SYSTEM_ALERT).catch(
      () => true,
    );
    if (!dup) needing.push(u.id);
  }

  let notifications_sent = 0;
  for (const userId of needing) {
    await notify({
      user_id: userId,
      event_type: NOTIFICATION_EVENT.VA_STATISTICS_WEEKLY_SUMMARY,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: `📈 VA Statistics — ${dateLabel}`,
      body,
      entity_type: "system",
      entity_id: entityId,
      _triggerSource: "va_statistics_weekly_cron",
    }).catch((err) => console.error("[va-statistics-weekly] notify failed", userId, err));
    notifications_sent += 1;
  }

  return {
    ok: true,
    range_start: startYmd,
    range_end: endYmd,
    notifications_sent,
    skipped_all_duplicates: needing.length === 0 && recipients.length > 0,
    team_completion_rate: report.team.tasks.completion_rate,
    vas_below_70_pct: report.team.vas_below_70_pct,
    no_shows: report.team.shifts.no_shows,
    hours: report.team.shifts.total_hours,
  };
}
