import { NextResponse } from "next/server";
import { runVaStatisticsWeeklySummary } from "@/services/va-statistics-weekly-cron";

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
 * GET /api/cron/va-statistics-weekly
 * Weekly digest of VA task/shift performance for users with va_statistics:view.
 * Triggered Mondays 06:00 UTC (~09:00 Athens+3) via Cloudflare Worker cron.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runVaStatisticsWeeklySummary();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/va-statistics-weekly]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "VA statistics weekly summary failed" },
      { status: 500 },
    );
  }
}
