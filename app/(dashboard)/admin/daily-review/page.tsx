import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { todayReviewIso } from "@/lib/marketing-reviews-helpers";
import { getDailyReviewByDate, getDailyReviewDetail, getDailyReviews } from "@/services/marketing-reviews";
import { listAllUsers } from "@/services/users";
import { AdminDailyReviewClient } from "@/components/admin-daily-review-client";

export default async function AdminDailyReviewPage() {
  await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.DAILY_REVIEW_MANAGE);

  const today = todayReviewIso();
  const [reviews, todayRow, allUsers] = await Promise.all([
    getDailyReviews().catch(() => []),
    getDailyReviewByDate(today).catch(() => null),
    listAllUsers().catch(() => []),
  ]);

  const todayReview = todayRow ? await getDailyReviewDetail(todayRow.id).catch(() => null) : null;

  const vaUsers = allUsers.filter(
    (u) => u.role === "virtual_assistant" || u.secondary_role === "virtual_assistant",
  );

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <AdminDailyReviewClient initialReviews={reviews} todayReview={todayReview} vaUsers={vaUsers} />
    </div>
  );
}
