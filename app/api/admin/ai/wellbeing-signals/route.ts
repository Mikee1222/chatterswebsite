import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { isAdminAreaUser } from "@/lib/rbac";
import { generateWellbeingEarlyWarnings } from "@/services/ai-ops-features";
import { runWellbeingCheckinAlerts } from "@/services/ai-fraud-alerts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Admin-only private wellbeing signals. NEVER expose to the subject person.
 */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminAreaUser(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await generateWellbeingEarlyWarnings({ force: false });
    return NextResponse.json({
      ...result,
      privacy: "admin_only_never_show_to_subject",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Wellbeing scan failed";
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
    const result = await generateWellbeingEarlyWarnings({ force: Boolean(body.force) });
    let notifications_sent = 0;
    if (body.notify) {
      const alert = await runWellbeingCheckinAlerts();
      notifications_sent = alert.notifications_sent;
    }
    return NextResponse.json({
      ...result,
      notifications_sent,
      privacy: "admin_only_never_show_to_subject",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Wellbeing scan failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
