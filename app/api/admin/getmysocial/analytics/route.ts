import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getGetMySocialAnalyticsForModel } from "@/services/getmysocial-analytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/getmysocial/analytics?modelId=…
 */
export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.INSTAGRAM_INSIGHTS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get("modelId")?.trim();
  if (!modelId) {
    return NextResponse.json({ error: "modelId is required" }, { status: 400 });
  }

  try {
    const data = await getGetMySocialAnalyticsForModel(modelId, {
      startYmd: searchParams.get("start")?.trim() || undefined,
      endYmd: searchParams.get("end")?.trim() || undefined,
      timeframe: searchParams.get("timeframe")?.trim() || "thisMonth",
    });
    return NextResponse.json({ data });
  } catch (err) {
    console.error("[admin/getmysocial/analytics]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load analytics" },
      { status: 500 }
    );
  }
}
