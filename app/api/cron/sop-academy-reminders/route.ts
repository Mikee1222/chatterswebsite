import { NextResponse } from "next/server";
import { runSopAcademyReminderCron } from "@/services/sop-academy-notifications";

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
 * GET /api/cron/sop-academy-reminders
 * Daily reminders for members with incomplete SOP academy training.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSopAcademyReminderCron();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "SOP academy reminder cron failed" },
      { status: 500 }
    );
  }
}
