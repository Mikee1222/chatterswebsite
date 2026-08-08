import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { toReviewDateKey, todayReviewIso } from "@/lib/marketing-reviews-helpers";
import { getAdminDailyReviewChecklistForDate } from "@/services/daily-review-checklist";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.DAILY_REVIEW_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dateParam = new URL(req.url).searchParams.get("date");
  const date = toReviewDateKey(dateParam) || todayReviewIso();
  const checklist = await getAdminDailyReviewChecklistForDate({ date });
  return NextResponse.json({ checklist });
}
