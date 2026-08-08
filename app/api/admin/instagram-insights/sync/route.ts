import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { syncClarioSuiteInsights } from "@/services/clariosuite-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/admin/instagram-insights/sync
 * Manual sync trigger for admins.
 */
export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.INSTAGRAM_INSIGHTS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let modelRecordId: string | undefined;
  try {
    const body = (await request.json().catch(() => ({}))) as { modelId?: string };
    modelRecordId = body.modelId?.trim() || undefined;
  } catch {
    modelRecordId = undefined;
  }

  try {
    const result = await syncClarioSuiteInsights({ modelRecordId });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[admin/instagram-insights/sync]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
