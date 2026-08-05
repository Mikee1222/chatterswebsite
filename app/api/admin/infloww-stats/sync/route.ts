import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { EMPLOYEE_REPORT_MAX_LOOKBACK_DAYS } from "@/lib/infloww-api";
import { getTodayYmdAthens, addDaysAthensYmd } from "@/lib/airtable-datetime";
import { syncInflowwDailyStats } from "@/services/infloww-daily-stats";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/admin/infloww-stats/sync
 * Admin-only backfill / re-sync for a date range (≤366 days lookback).
 * Body: { startYmd?, endYmd?, publicUserIds? }
 */
export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.INFLOWW_STATS_VIEW_ALL))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { startYmd?: string; endYmd?: string; publicUserIds?: string[] } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const today = getTodayYmdAthens();
  const earliest = addDaysAthensYmd(today, -(EMPLOYEE_REPORT_MAX_LOOKBACK_DAYS - 1));
  const startYmd = (body.startYmd ?? addDaysAthensYmd(today, -1)).slice(0, 10);
  const endYmd = (body.endYmd ?? addDaysAthensYmd(today, -1)).slice(0, 10);

  if (startYmd < earliest || endYmd < earliest) {
    return NextResponse.json(
      {
        error: `Date range must be within the last ${EMPLOYEE_REPORT_MAX_LOOKBACK_DAYS} days (earliest ${earliest}).`,
      },
      { status: 400 }
    );
  }

  try {
    const result = await syncInflowwDailyStats({
      startYmd,
      endYmd,
      publicUserIds: body.publicUserIds,
    });
    if (result.errors.length > 0) {
      console.error("[admin/infloww-stats/sync] employee errors", {
        count: result.errors.length,
        errors: result.errors.slice(0, 20),
      });
    }
    return NextResponse.json({ success: result.errors.length === 0, ...result });
  } catch (err) {
    console.error("[admin/infloww-stats/sync]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
