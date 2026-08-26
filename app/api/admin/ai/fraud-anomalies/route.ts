import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { isAdminAreaUser } from "@/lib/rbac";
import {
  attachExplanationsToFlags,
  runFraudAnomalyDetection,
} from "@/services/ai-ops-features";
import { runFraudAnomalyAlerts } from "@/services/ai-fraud-alerts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET — scan + explain (cached). POST — force refresh; optional notify=true. */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminAreaUser(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await runFraudAnomalyDetection({ force: false });
    return NextResponse.json({
      ...result,
      flags: attachExplanationsToFlags(result.scan.flags, result.explanations),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Fraud scan failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminAreaUser(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    force?: boolean;
    notify?: boolean;
  };

  try {
    const result = await runFraudAnomalyDetection({ force: Boolean(body.force) });
    let notifications_sent = 0;
    if (body.notify) {
      const alert = await runFraudAnomalyAlerts();
      notifications_sent = alert.notifications_sent;
    }
    return NextResponse.json({
      ...result,
      flags: attachExplanationsToFlags(result.scan.flags, result.explanations),
      notifications_sent,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Fraud scan failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
