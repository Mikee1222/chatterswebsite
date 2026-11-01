import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { parseDailyReviewFilters } from "@/lib/daily-review-filters";
import { toReviewDateKey, todayReviewIso } from "@/lib/marketing-reviews-helpers";
import { getAdminDailyReviewChecklistForDate } from "@/services/daily-review-checklist";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.DAILY_REVIEW_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  const date = toReviewDateKey(dateParam) || todayReviewIso();
  const filters = parseDailyReviewFilters(url.searchParams);
  const checklist = await getAdminDailyReviewChecklistForDate({ date, filters });
  // Screenshots (signed URLs) ride on the shared live checklist. Gated by
  // DAILY_REVIEW_MANAGE — not a broader storage grant.
  return NextResponse.json({ checklist });
}
