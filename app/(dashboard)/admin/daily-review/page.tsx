import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  emptyDailyReviewFilters,
  parseDailyReviewFilters,
} from "@/lib/daily-review-filters";
import { spotCheckManagerName, todayReviewIso } from "@/lib/marketing-reviews-helpers";
import { getAdminDailyReviewChecklistForDate } from "@/services/daily-review-checklist";
import { getDailyReviews } from "@/services/marketing-reviews";
import { AdminDailyReviewClient } from "@/components/admin-daily-review-client";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminDailyReviewPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const user = await getSessionFromCookies();
  await requireAdminRoute(user, PERMISSIONS.DAILY_REVIEW_MANAGE);

  const params = (await searchParams) ?? {};
  const filters = parseDailyReviewFilters(params);
  const today = todayReviewIso();
  const [reviews, checklist] = await Promise.all([
    getDailyReviews().catch(() => []),
    getAdminDailyReviewChecklistForDate({ date: today, filters }).catch(() => ({
      date: today,
      reviews: [],
      shared_vas: [],
      team_summary: {
        total_items: 0,
        va_completed: 0,
        verified: 0,
        flagged: 0,
        unverified: 0,
        vas_reviewed: 0,
        tasks: 0,
        overdue: 0,
        supervisors: 0,
      },
      leaderboard: { vas_by_flags: [], supervisors_by_activity: [] },
      facets: {
        roles: [],
        people: [],
        models: [],
        phases: [],
        platforms: [],
        item_types: [],
      },
      filters: emptyDailyReviewFilters(),
    })),
  ]);

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <AdminDailyReviewClient
        initialReviews={reviews}
        initialChecklist={checklist}
        senderFullName={spotCheckManagerName(user!)}
      />
    </div>
  );
}
