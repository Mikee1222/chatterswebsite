import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { todayReviewIso } from "@/lib/marketing-reviews-helpers";
import { buildRoleLabels, toStaffUserOptions } from "@/lib/staff-assignee-data";
import { getDailyReviewByDate, getDailyReviewDetail, getDailyReviews } from "@/services/marketing-reviews";
import { getRoles } from "@/services/roles";
import { listActiveUsers } from "@/services/users";
import { AdminDailyReviewClient } from "@/components/admin-daily-review-client";

export default async function AdminDailyReviewPage() {
  await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.DAILY_REVIEW_MANAGE);

  const today = todayReviewIso();
  const [reviews, todayRow, activeUsers, roles] = await Promise.all([
    getDailyReviews().catch(() => []),
    getDailyReviewByDate(today).catch(() => null),
    listActiveUsers().catch(() => []),
    getRoles().catch(() => []),
  ]);

  const todayReview = todayRow ? await getDailyReviewDetail(todayRow.id).catch(() => null) : null;

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <AdminDailyReviewClient
        initialReviews={reviews}
        todayReview={todayReview}
        staffUsers={toStaffUserOptions(activeUsers)}
        roleLabels={buildRoleLabels(roles)}
      />
    </div>
  );
}
