import { NextResponse } from "next/server";
import { addDaysAthensYmd } from "@/lib/airtable-datetime";
import { inflowwReportTodayYmd } from "@/lib/infloww-api";
import { syncInflowwCreatorEarnings } from "@/services/infloww-creator-earnings";
import { syncInflowwDailyStats } from "@/services/infloww-daily-stats";
import { runInflowwPerformanceAlerts } from "@/services/infloww-performance-alerts";
import { dailySyncCreatorStatusLog } from "@/services/infloww-creator-status-log";
import { dailySyncSalesReassignments } from "@/services/infloww-sales-reassignments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Employee + creator sync within Vercel limits. */
export const maxDuration = 300;

function isCronAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;
  const headerSecret = request.headers.get("x-cron-secret");
  if (headerSecret === cronSecret) return true;
  return false;
}

/**
 * GET /api/cron/sync-infloww-stats
 * Syncs Infloww-safe today + previous day for:
 * 1) Employee daily stats (users with infloww_employee_id)
 * 2) Creator earnings (modelss matched to Infloww creators — transactions,
 *    creator-report incl. renew-on, marketing links/fans, refunds,
 *    priority mass messages; re-syncs status=loading txs)
 * 3) High-value performance alerts (declining chatter WoW, refunds, churn)
 *
 * Cadence: every 2h via GitHub Actions (`sync-infloww-2h.yml`); daily fallback in
 * vercel.json (Hobby max). Sync window is always today+yesterday (incremental).
 * Do NOT set sub-daily schedules in vercel.json — see vercel.cron-notes.md.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const today = inflowwReportTodayYmd();
    const yesterday = addDaysAthensYmd(today, -1);
    const range = { startYmd: yesterday, endYmd: today };

    const employee = await syncInflowwDailyStats(range);
    if (employee.errors.length > 0) {
      console.error("[cron/sync-infloww-stats] employee errors", {
        count: employee.errors.length,
        errors: employee.errors.slice(0, 20),
      });
    }

    const creator = await syncInflowwCreatorEarnings(range);
    const creatorErrorCount =
      creator.dailyStats.errors.length +
      creator.transactions.errors.length +
      creator.marketingLinks.errors.length +
      creator.linkFans.errors.length +
      creator.refunds.errors.length +
      creator.priorityMassMessages.errors.length;
    if (creatorErrorCount > 0) {
      console.error("[cron/sync-infloww-stats] creator errors", {
        count: creatorErrorCount,
        dailyStats: creator.dailyStats.errors.slice(0, 10),
        transactions: creator.transactions.errors.slice(0, 10),
        marketing: creator.marketingLinks.errors.slice(0, 10),
        refunds: creator.refunds.errors.slice(0, 10),
        pmm: creator.priorityMassMessages.errors.slice(0, 10),
      });
    }

    let performanceAlerts: Awaited<ReturnType<typeof runInflowwPerformanceAlerts>> | null = null;
    try {
      performanceAlerts = await runInflowwPerformanceAlerts();
    } catch (alertErr) {
      console.error("[cron/sync-infloww-stats] performance alerts", alertErr);
    }

    let statusLog: Awaited<ReturnType<typeof dailySyncCreatorStatusLog>> | null = null;
    try {
      statusLog = await dailySyncCreatorStatusLog();
      if (statusLog.errors.length > 0) {
        console.error("[cron/sync-infloww-stats] status-log errors", statusLog.errors.slice(0, 5));
      }
    } catch (statusLogErr) {
      console.error("[cron/sync-infloww-stats] status-log sync failed", statusLogErr);
    }

    let salesReassignments: Awaited<ReturnType<typeof dailySyncSalesReassignments>> | null = null;
    try {
      salesReassignments = await dailySyncSalesReassignments();
      if (salesReassignments.errors.length > 0) {
        console.error("[cron/sync-infloww-stats] sales-reassignments errors", salesReassignments.errors.slice(0, 5));
      }
    } catch (reassignErr) {
      console.error("[cron/sync-infloww-stats] sales-reassignments sync failed", reassignErr);
    }

    return NextResponse.json({
      success: employee.errors.length === 0 && creatorErrorCount === 0,
      employee,
      creator,
      performanceAlerts,
      statusLog,
      salesReassignments,
    });
  } catch (err) {
    console.error("[cron/sync-infloww-stats]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
