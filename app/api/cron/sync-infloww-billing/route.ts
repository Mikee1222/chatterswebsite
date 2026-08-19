import { NextResponse } from "next/server";
import { syncInflowwMonthlyBilling } from "@/services/infloww-monthly-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Monthly billing sync is fast (agency-level, few records). */
export const maxDuration = 60;

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
 * GET /api/cron/sync-infloww-billing
 * Syncs Infloww monthly billing data for the trailing 12 months.
 * STRICT: 10 QPM rate limit on the source endpoint — run once daily only.
 * Schedule: daily at 04:00 UTC via vercel.json or GitHub Actions.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    // Sync trailing 12 months. yyyy-MM format.
    const now = new Date();
    const endTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const startTime = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;

    const result = await syncInflowwMonthlyBilling({ startTime, endTime });

    if (result.errors.length > 0) {
      console.error("[cron/sync-infloww-billing] errors", result.errors.slice(0, 10));
    }

    return NextResponse.json({ success: result.errors.length === 0, ...result });
  } catch (err) {
    console.error("[cron/sync-infloww-billing]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
