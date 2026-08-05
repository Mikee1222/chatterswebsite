import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  EMPLOYEE_REPORT_MAX_LOOKBACK_DAYS,
  inflowwReportTodayYmd,
} from "@/lib/infloww-api";
import { addDaysAthensYmd } from "@/lib/airtable-datetime";
import { syncInflowwDailyStats } from "@/services/infloww-daily-stats";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Long backfills (≤366d) chunk into 31-day windows; allow full run on Pro/Hobby max. */
export const maxDuration = 300;

/**
 * POST /api/admin/infloww-stats/sync
 * Admin-only backfill / re-sync for a date range (≤366 days lookback).
 * Body: { startYmd?, endYmd?, lookbackDays?, publicUserIds? }
 * endTime is always capped to Infloww-safe today (min Athens/UTC calendar day).
 * `lookbackDays` (1–366) sets start relative to that fixed end (overrides startYmd).
 */
export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.INFLOWW_STATS_VIEW_ALL))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    startYmd?: string;
    endYmd?: string;
    lookbackDays?: number;
    publicUserIds?: string[];
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const today = inflowwReportTodayYmd();
  const earliest = addDaysAthensYmd(today, -(EMPLOYEE_REPORT_MAX_LOOKBACK_DAYS - 1));

  let endYmd = (body.endYmd ?? today).slice(0, 10);
  if (endYmd > today) endYmd = today;

  let startYmd: string;
  const lookbackRaw = body.lookbackDays;
  if (lookbackRaw != null && Number.isFinite(Number(lookbackRaw))) {
    const lookback = Math.max(
      1,
      Math.min(EMPLOYEE_REPORT_MAX_LOOKBACK_DAYS, Math.floor(Number(lookbackRaw)))
    );
    startYmd = addDaysAthensYmd(endYmd, -(lookback - 1));
  } else {
    startYmd = (body.startYmd ?? addDaysAthensYmd(endYmd, -1)).slice(0, 10);
  }

  if (startYmd < earliest) startYmd = earliest;
  if (startYmd > endYmd) {
    return NextResponse.json({ error: "Invalid date range: start is after end." }, { status: 400 });
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
