import { NextResponse } from "next/server";
import { runDataRetentionCleanup } from "@/services/data-retention";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

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
 * GET /api/cron/data-retention
 * Daily prune of unbounded-growth tables (visitor events, access logs,
 * agent action log, old notifications). Does not delete Storage files.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runDataRetentionCleanup();
    if (result.errors.length > 0) {
      console.error("[cron/data-retention] errors", result.errors);
    }
    return NextResponse.json({
      success: result.errors.length === 0,
      ...result,
    });
  } catch (err) {
    console.error("[cron/data-retention]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Retention cleanup failed" },
      { status: 500 },
    );
  }
}
