import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import {
  filterDailyReviewsByManager,
  spotCheckManagerId,
  spotCheckManagerName,
  todayReviewIso,
} from "@/lib/marketing-reviews-helpers";
import { getDailyReviewChecklistForDate } from "@/services/daily-review-checklist";
import {
  getDailyReviewByDate,
  getDailyReviews,
} from "@/services/marketing-reviews";
import { SupervisorDailyReviewClient } from "@/components/supervisor-daily-review-client";

export default async function DailyReviewSubmitPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (!(await hasPermission(user, PERMISSIONS.DAILY_REVIEW_SUBMIT))) {
    redirect(ROUTES.dashboard);
  }

  const managerName = spotCheckManagerName(user);
  const managerId = spotCheckManagerId(user);
  const today = todayReviewIso();
  const [allReviews, todayRow, checklist] = await Promise.all([
    getDailyReviews({ manager_id: managerId }).catch(() => []),
    getDailyReviewByDate(today, managerName, managerId).catch(() => null),
    getDailyReviewChecklistForDate({ date: today }).catch(() => ({
      date: today,
      vas: [],
      summary: {
        total_items: 0,
        va_completed: 0,
        verified: 0,
        flagged: 0,
        unverified: 0,
        vas_reviewed: 0,
        tasks: 0,
      },
      review_id: null,
    })),
  ]);

  const mySubmissions = filterDailyReviewsByManager(allReviews, managerName, managerId);
  const initialChecklist = todayRow
    ? await getDailyReviewChecklistForDate({ date: today, reviewId: todayRow.id }).catch(() => checklist)
    : checklist;

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <SupervisorDailyReviewClient
        initialSubmissions={mySubmissions}
        initialChecklist={initialChecklist}
        initialReview={todayRow}
      />
    </div>
  );
}
