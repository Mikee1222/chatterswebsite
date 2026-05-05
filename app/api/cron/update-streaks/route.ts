import { NextResponse } from "next/server";
import { runUpdateStreaksForActiveChatters } from "@/services/points-engine";

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
 * GET /api/cron/update-streaks
 * Intended to run daily at midnight Europe/Athens (configure Cloudflare Cron or external scheduler).
 * Updates streak_days for active chatters and may award 5- / 30-day streak bonuses.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runUpdateStreaksForActiveChatters();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/update-streaks]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}
