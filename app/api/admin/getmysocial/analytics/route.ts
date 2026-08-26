import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getGetMySocialAgencyOverview,
  getGetMySocialAnalyticsForModel,
} from "@/services/getmysocial-analytics";
import { resolveInflowwStatsRange } from "@/services/infloww-performance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/getmysocial/analytics?modelId=…
 * GET /api/admin/getmysocial/analytics?agency=1&start=&end=
 */
export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.INSTAGRAM_INSIGHTS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const agency = searchParams.get("agency") === "1" || searchParams.get("scope") === "agency";

  try {
    if (agency) {
      const start = searchParams.get("start")?.trim();
      const end = searchParams.get("end")?.trim();
      const range =
        start && end
          ? { startYmd: start, endYmd: end }
          : resolveInflowwStatsRange("this_month", null, null);
      const data = await getGetMySocialAgencyOverview({
        startYmd: range.startYmd,
        endYmd: range.endYmd,
      });
      return NextResponse.json({ data });
    }

    const modelId = searchParams.get("modelId")?.trim();
    if (!modelId) {
      return NextResponse.json({ error: "modelId is required (or agency=1)" }, { status: 400 });
    }

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
