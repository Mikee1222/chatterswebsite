import { NextResponse } from "next/server";
import { runWhaleFollowupReminders } from "@/services/cron-notification-jobs";

export const dynamic = "force-dynamic";

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
 * GET /api/cron/whale-followups
 * Notifies assigned chatters when a whale's next_followup date is due today or overdue.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runWhaleFollowupReminders();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Whale follow-up cron failed" },
      { status: 500 }
    );
  }
}
