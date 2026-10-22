import { NextResponse } from "next/server";
import { getBriefReminderLeadHours } from "@/services/brief-reminder-settings";
import { runRecordingBriefDeadlineJobs } from "@/services/recording-briefs";
import { runEditingBriefDeadlineJobs } from "@/services/editing-briefs";

/**
 * Auth: when CRON_SECRET is set, require Authorization: Bearer <CRON_SECRET> or x-cron-secret.
 * When unset (dev), allow so manual calls work.
 */
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
 * GET /api/cron/brief-deadlines
 * Recording + Editing Brief reminders (lead hours from system_settings) and overdue alerts.
 * Each reminder / overdue fires exactly once (reminder_sent_at / overdue_alerted_at).
 * Schedule: every 30 minutes.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const leadHours = await getBriefReminderLeadHours();
    const [recording, editing] = await Promise.all([
      runRecordingBriefDeadlineJobs(leadHours),
      runEditingBriefDeadlineJobs(leadHours),
    ]);
    return NextResponse.json({
      ok: true,
      lead_hours: leadHours,
      recording,
      editing,
    });
  } catch (err) {
    console.error("[cron/brief-deadlines]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cron failed" },
      { status: 500 },
    );
  }
}
