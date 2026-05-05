import { NextResponse } from "next/server";
import { runCheckBreakReminders } from "@/services/check-break-reminders";

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
 * GET /api/test-break-reminder
 * Runs the same logic as GET /api/cron/check-break-reminders without waiting for the Worker schedule.
 * Auth: same as cron (CRON_SECRET via Bearer or x-cron-secret); when CRON_SECRET is unset, allowed for local dev.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[test-break-reminder] manual run", { now: new Date().toISOString() });

  try {
    const result = await runCheckBreakReminders();
    return NextResponse.json({ ...result, source: "test-break-reminder" });
  } catch (err) {
    console.error("[test-break-reminder]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Check failed" },
      { status: 500 }
    );
  }
}
