import { NextResponse } from "next/server";
import { runAiNotificationDigest } from "@/services/ai-notification-digest-cron";

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
 * GET /api/cron/ai-notification-digest
 * 20:00 UTC daily — opt-in AI digests for users with event_overrides.ai_notification_digest === true.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runAiNotificationDigest();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/ai-notification-digest]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI notification digest failed" },
      { status: 500 },
    );
  }
}
