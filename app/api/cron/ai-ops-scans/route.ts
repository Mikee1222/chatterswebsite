import { NextResponse } from "next/server";
import { runFraudAnomalyAlerts, runWellbeingCheckinAlerts } from "@/services/ai-fraud-alerts";

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
 * GET /api/cron/ai-ops-scans
 * Runs fraud anomaly + wellbeing early-warning scans and notifies admins.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const [fraud, wellbeing] = await Promise.all([
      runFraudAnomalyAlerts(),
      runWellbeingCheckinAlerts(),
    ]);
    return NextResponse.json({ ok: true, fraud, wellbeing });
  } catch (err) {
    console.error("[cron/ai-ops-scans]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI ops scans failed" },
      { status: 500 },
    );
  }
}
