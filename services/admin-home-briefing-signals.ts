/**
 * Collect ops signals for Admin Home AI daily briefing.
 */

import { getTodayYmdAthens } from "@/lib/airtable-datetime";
import { getApplicationFormsOverview } from "@/services/application-forms";
import { getAdminDailyReviewChecklistForDate } from "@/services/daily-review-checklist";
import { getSpotChecks } from "@/services/marketing-reviews";
import { getInstagramWeeklyProgressReport } from "@/services/instagram-weekly-progress";
import type { AdminHomeBriefingSignals } from "@/services/ai-powered-features";

export type AdminHomeClientMetrics = {
  todaySalesUsd?: number;
  sparklineWowPct?: number | null;
  topChatterName?: string;
  topChatterRevenue?: number;
  topModelName?: string;
  topModelRevenue?: number;
  monthlyRevenue?: number;
  pendingCustoms?: number;
  activeChatterShifts?: number;
  activeVaShifts?: number;
};

export type OpsBriefingSignals = Pick<
  AdminHomeBriefingSignals,
  | "pendingApplications"
  | "pendingSpotChecks"
  | "dailyReviewTodayExists"
  | "dailyReviewVerified"
  | "dailyReviewFlagged"
  | "igNeedsAttentionCount"
  | "igNeedsAttentionModels"
>;

/** Pending apps (status new), pending spot checks, daily review team_summary, IG Needs Attention. */
export async function collectAdminHomeOpsSignals(): Promise<OpsBriefingSignals> {
  const todayYmd = getTodayYmdAthens();
  const [year, month] = todayYmd.split("-").map(Number) as [number, number];

  const [overview, pendingSpots, checklist, igReport] = await Promise.all([
    getApplicationFormsOverview().catch(() => null),
    getSpotChecks({ status: "Pending" }).catch(() => []),
    getAdminDailyReviewChecklistForDate({ date: todayYmd }).catch(() => null),
    getInstagramWeeklyProgressReport(year, month).catch(() => null),
  ]);

  const igNeedsAttentionModels: string[] = [];
  if (igReport) {
    for (const model of igReport.models) {
      const latest = [...model.weeks].reverse().find((w) => w.hasStarted);
      if (!latest) continue;
      if (latest.insights.some((t) => t.label === "Needs Attention")) {
        igNeedsAttentionModels.push(model.modelName);
      }
    }
  }

  return {
    pendingApplications: overview?.awaiting_review ?? 0,
    pendingSpotChecks: pendingSpots.length,
    dailyReviewTodayExists: (checklist?.reviews.length ?? 0) > 0,
    dailyReviewVerified: checklist?.team_summary.verified ?? 0,
    dailyReviewFlagged: checklist?.team_summary.flagged ?? 0,
    igNeedsAttentionCount: igNeedsAttentionModels.length,
    igNeedsAttentionModels: igNeedsAttentionModels.slice(0, 12),
  };
}

export async function buildAdminHomeBriefingSignals(
  client: AdminHomeClientMetrics = {},
): Promise<AdminHomeBriefingSignals> {
  const todayYmd = getTodayYmdAthens();
  const ops = await collectAdminHomeOpsSignals();
  return {
    todayYmd,
    todaySalesUsd: Number(client.todaySalesUsd) || 0,
    sparklineWowPct:
      client.sparklineWowPct === undefined || client.sparklineWowPct === null
        ? null
        : Number(client.sparklineWowPct),
    topChatterName: String(client.topChatterName ?? "").trim() || "—",
    topChatterRevenue: Number(client.topChatterRevenue) || 0,
    topModelName: String(client.topModelName ?? "").trim() || "—",
    topModelRevenue: Number(client.topModelRevenue) || 0,
    monthlyRevenue: Number(client.monthlyRevenue) || 0,
    pendingCustoms: Number(client.pendingCustoms) || 0,
    activeChatterShifts: Number(client.activeChatterShifts) || 0,
    activeVaShifts: Number(client.activeVaShifts) || 0,
    ...ops,
  };
}
