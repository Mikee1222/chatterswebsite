import { NextResponse } from "next/server";
import { syncGetMySocialAnalytics } from "@/services/getmysocial-sync";

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
 * GET /api/cron/sync-getmysocial
 * Incremental GetMySocial link analytics for linked model pages.
 * Cadence: every 2h via GitHub Actions (`sync-getmysocial-2h.yml`); daily
 * fallback in vercel.json (Hobby max). No-ops when GETMYSOCIAL_API_KEY unset.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncGetMySocialAnalytics();
    if (result.errors.length > 0) {
      console.error("[cron/sync-getmysocial] errors", {
        count: result.errors.length,
        errors: result.errors.slice(0, 20),
      });
    }
    return NextResponse.json({
      success: result.errors.length === 0 && !result.skipped,
      ...result,
    });
  } catch (err) {
    console.error("[cron/sync-getmysocial]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
