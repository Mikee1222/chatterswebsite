import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getTodayYmdAthens } from "@/lib/airtable-datetime";
import { getAdminDailyReviewChecklistForDate } from "@/services/daily-review-checklist";
import {
  AI_FEATURE_KEYS,
  generateDailyReviewTeamSummary,
} from "@/services/ai-powered-features";
import { getAiFeatureCache, isAiCacheStale } from "@/services/ai-feature-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;

function reviewCacheKey(date: string, reviewIds: string[]): string {
  if (reviewIds.length === 0) return `empty:${date}`;
  return [...reviewIds].sort().join(",");
}

/**
 * GET/POST /api/admin/ai/daily-review-summary
 * Summarize Daily Review checklist for a date (DAILY_REVIEW_MANAGE).
 */
export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.DAILY_REVIEW_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date")?.trim() || getTodayYmdAthens();
  const checklist = await getAdminDailyReviewChecklistForDate({ date });
  const cacheKey = reviewCacheKey(date, checklist.reviews.map((r) => r.review.id));
  const cached = await getAiFeatureCache(AI_FEATURE_KEYS.DAILY_REVIEW_SUMMARY, cacheKey);
  if (!cached || isAiCacheStale(cached, DAY_MS)) {
    return NextResponse.json({ text: null, generated_at: null, cached: false, date });
  }
  return NextResponse.json({
    text: cached.content_text,
    generated_at: cached.generated_at,
    cached: true,
    date,
  });
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.DAILY_REVIEW_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { date?: string; force?: boolean };
  const date = String(body.date ?? "").trim() || getTodayYmdAthens();

  try {
    const checklist = await getAdminDailyReviewChecklistForDate({ date });
    const reviewIds = checklist.reviews.map((r) => r.review.id);
    const cacheKey = reviewCacheKey(date, reviewIds);

    const flaggedItems: Array<Record<string, unknown>> = [];
    for (const va of checklist.shared_vas) {
      for (const task of va.tasks) {
        for (const item of task.items) {
          const flagged = item.verifications.filter((v) => v.verified_status === "flagged_not_done");
          if (flagged.length === 0) continue;
          flaggedItems.push({
            va_name: va.va_name,
            task_title: task.task_title,
            item_title: item.title,
            flagged_by: flagged.map((v) => v.verified_by_name),
          });
        }
      }
    }

    const result = await generateDailyReviewTeamSummary({
      reviewId: cacheKey,
      reviewDate: date,
      teamSummary: checklist.team_summary as unknown as Record<string, unknown>,
      flaggedItems,
      vaLeaderboard: checklist.leaderboard.vas_by_flags as unknown as Array<Record<string, unknown>>,
      force: Boolean(body.force),
    });
    return NextResponse.json({ ...result, date });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate summary";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
