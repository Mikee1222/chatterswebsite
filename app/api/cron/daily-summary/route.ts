import { NextResponse } from "next/server";
import { runDailySummaryNotifications } from "@/services/daily-summary-cron";

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
 * GET /api/cron/daily-summary
 * Midnight UTC (~3:00 AM GMT+3): previous calendar day in GMT+3 — shifts, models on shifts,
 * pending customs count, whale revenue; notifies admins (deduped per day).
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runDailySummaryNotifications();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/daily-summary]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Daily summary failed" },
      { status: 500 }
    );
  }
}
