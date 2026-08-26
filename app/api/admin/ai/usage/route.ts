import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getAiUsageSummary } from "@/services/ai-usage-log";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/ai/usage — approximate Anthropic call counts (integrations:view). */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, PERMISSIONS.INTEGRATIONS_VIEW)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const summary = await getAiUsageSummary();
    return NextResponse.json(summary);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load AI usage";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
