import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  currentAthensYearMonth,
  getAdminInflowwPerformanceReport,
  getAdminWeeklyProgressReport,
  getChatterInflowwPerformance,
  resolveInflowwStatsRange,
  type InflowwStatsPreset,
} from "@/services/infloww-performance";

export const dynamic = "force-dynamic";

const PRESETS = new Set<InflowwStatsPreset>([
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "custom",
]);

/**
 * GET /api/infloww-stats
 * Query: preset, start, end, userId (admin), performerId (admin), includeRoi (admin)
 * Weekly Progress (admin only): view=weekly_progress&year=&month=
 */
export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const view = url.searchParams.get("view");

  const canViewAll = await hasPermission(session, PERMISSIONS.INFLOWW_STATS_VIEW_ALL);
  const canViewOwn = await hasPermission(session, PERMISSIONS.INFLOWW_STATS_VIEW_OWN);

  if (view === "weekly_progress") {
    if (!canViewAll) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const athens = currentAthensYearMonth();
    const yearRaw = url.searchParams.get("year");
    const monthRaw = url.searchParams.get("month");
    const year = yearRaw ? Number.parseInt(yearRaw, 10) : athens.year;
    const month = monthRaw ? Number.parseInt(monthRaw, 10) : athens.month;
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
    }
    const userId = url.searchParams.get("userId") ?? undefined;
    const report = await getAdminWeeklyProgressReport(year, month, {
      publicUserId: userId,
    });
    return NextResponse.json(report);
  }

  const rawPreset = (url.searchParams.get("preset") ?? "this_week") as InflowwStatsPreset;
  const preset = PRESETS.has(rawPreset) ? rawPreset : "this_week";
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const range = resolveInflowwStatsRange(preset, start, end);

  if (canViewAll) {
    const userId = url.searchParams.get("userId") ?? undefined;
    const performerRaw = url.searchParams.get("performerId");
    const performerId =
      performerRaw != null && performerRaw !== ""
        ? Number.parseInt(performerRaw, 10)
        : undefined;
    const includeRoi = url.searchParams.get("includeRoi") === "1";
    const report = await getAdminInflowwPerformanceReport(range, {
      publicUserId: userId,
      performerId: Number.isFinite(performerId) ? performerId : undefined,
      includeRoi,
    });
    return NextResponse.json(report);
  }

  if (!canViewOwn) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const performance = await getChatterInflowwPerformance(session.id, range);
  return NextResponse.json(performance);
}
