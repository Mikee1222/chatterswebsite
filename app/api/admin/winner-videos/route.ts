import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getAllWinnerVideos, type WinnerVideoFilters } from "@/services/winner-videos";
import type { WinnerVideoStatus } from "@/lib/winner-videos-helpers";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.WINNER_VIDEOS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const filters: WinnerVideoFilters = {};
  const status = searchParams.get("status");
  if (status) filters.status = status as WinnerVideoStatus;
  const submittedBy = searchParams.get("submitted_by_id");
  if (submittedBy) filters.submitted_by_id = submittedBy;
  const dateFrom = searchParams.get("date_from");
  if (dateFrom) filters.date_from = dateFrom;
  const dateTo = searchParams.get("date_to");
  if (dateTo) filters.date_to = dateTo;

  const videos = await getAllWinnerVideos(filters);
  return NextResponse.json({ videos });
}
