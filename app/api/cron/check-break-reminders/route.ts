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
 * GET /api/cron/check-break-reminders
 * Sends push when `break_reminder_at` is due for shifts on break; clears the field after send.
 * Auth: same as other cron routes (CRON_SECRET via Bearer or x-cron-secret).
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runCheckBreakReminders();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/check-break-reminders]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Check failed" },
      { status: 500 }
    );
  }
}
