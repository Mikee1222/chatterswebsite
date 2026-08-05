import { NextResponse } from "next/server";
import { addDaysAthensYmd } from "@/lib/airtable-datetime";
import { inflowwReportTodayYmd } from "@/lib/infloww-api";
import { syncInflowwDailyStats } from "@/services/infloww-daily-stats";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Allow multi-employee today+yesterday sync within Vercel limits. */
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
 * Syncs Infloww-safe today + previous day for all users with infloww_employee_id.
 * Cadence: hourly via GitHub Actions (Hobby cannot use vercel.json hourly crons);
 * Vercel keeps a daily 03:15 UTC fallback. Auth: Bearer / x-cron-secret CRON_SECRET.
 * endTime uses min(Athens today, UTC today) so Infloww never sees a "future"
 * calendar day across the Athens/UTC boundary. Upserts on
 * (user_id, infloww_performer_id, date) so same-day re-runs overwrite.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const today = inflowwReportTodayYmd();
    const yesterday = addDaysAthensYmd(today, -1);
    const result = await syncInflowwDailyStats({
      startYmd: yesterday,
      endYmd: today,
    });
    if (result.errors.length > 0) {
      console.error("[cron/sync-infloww-stats] employee errors", {
        count: result.errors.length,
        errors: result.errors.slice(0, 20),
      });
    }
    return NextResponse.json({
      success: result.errors.length === 0,
      ...result,
    });
  } catch (err) {
    console.error("[cron/sync-infloww-stats]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
