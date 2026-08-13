import { NextResponse } from "next/server";
import { syncClarioSuiteInsights } from "@/services/clariosuite-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
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
 * GET /api/cron/sync-clariosuite
 * Incremental ClarioSuite Instagram insights for linked model accounts (trailing
 * 14-day daily insights window; audience + top posts refreshed each run).
 * Cadence: every 2h via GitHub Actions (`sync-clariosuite-2h.yml`); daily
 * fallback in vercel.json (Hobby max). No-ops when CLARIOSUITE_API_KEY unset.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncClarioSuiteInsights();
    if (result.errors.length > 0) {
      console.error("[cron/sync-clariosuite] errors", {
        count: result.errors.length,
        errors: result.errors.slice(0, 20),
      });
    }
    return NextResponse.json({
      success: result.errors.length === 0,
      ...result,
    });
  } catch (err) {
    console.error("[cron/sync-clariosuite]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
