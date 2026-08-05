import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getAdminInflowwPerformanceReport,
  getChatterInflowwPerformance,
  resolveInflowwStatsRange,
  type InflowwStatsPreset,
} from "@/services/infloww-performance";

export const dynamic = "force-dynamic";

/**
 * GET /api/infloww-stats
 * Query: preset, start, end, userId (admin), performerId (admin)
 */
export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const preset = (url.searchParams.get("preset") ?? "this_week") as InflowwStatsPreset;
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const range = resolveInflowwStatsRange(preset, start, end);

  const canViewAll = await hasPermission(session, PERMISSIONS.INFLOWW_STATS_VIEW_ALL);
  const canViewOwn = await hasPermission(session, PERMISSIONS.INFLOWW_STATS_VIEW_OWN);

  if (canViewAll) {
    const userId = url.searchParams.get("userId") ?? undefined;
    const performerRaw = url.searchParams.get("performerId");
    const performerId =
      performerRaw != null && performerRaw !== ""
        ? Number.parseInt(performerRaw, 10)
        : undefined;
    const report = await getAdminInflowwPerformanceReport(range, {
      publicUserId: userId,
      performerId: Number.isFinite(performerId) ? performerId : undefined,
    });
    return NextResponse.json(report);
  }

  if (!canViewOwn) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const performance = await getChatterInflowwPerformance(session.id, range);
  return NextResponse.json(performance);
}
