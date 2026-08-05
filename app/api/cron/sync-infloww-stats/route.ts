import { NextResponse } from "next/server";
import { getTodayYmdAthens, addDaysAthensYmd } from "@/lib/airtable-datetime";
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
 * Hourly: syncs today + yesterday (Athens) for all users with infloww_employee_id.
 * Upserts on (user_id, infloww_performer_id, date) so same-day re-runs overwrite.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const today = getTodayYmdAthens();
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
