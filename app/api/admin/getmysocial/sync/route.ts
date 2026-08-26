import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { syncGetMySocialAnalytics } from "@/services/getmysocial-sync";
import type { GetMySocialTimeframe } from "@/types/getmysocial";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/admin/getmysocial/sync
 */
export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.INTEGRATIONS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    modelId?: string;
    timeframe?: GetMySocialTimeframe;
  } | null;

  try {
    const result = await syncGetMySocialAnalytics({
      modelId: body?.modelId?.trim() || undefined,
      timeframe: body?.timeframe,
    });
    return NextResponse.json(result, {
      status: result.skipped && result.errors.length === 0 ? 200 : result.errors.length ? 207 : 200,
    });
  } catch (err) {
    console.error("[admin/getmysocial/sync]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
