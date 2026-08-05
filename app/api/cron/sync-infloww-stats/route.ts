import { NextResponse } from "next/server";
import { syncInflowwDailyStats } from "@/services/infloww-daily-stats";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Allow multi-employee day sync within Vercel limits. */
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
 * Syncs previous Athens calendar day for all users with infloww_employee_id.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncInflowwDailyStats();
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
