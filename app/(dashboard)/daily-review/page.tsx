import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import {
  filterDailyReviewsByManager,
  spotCheckManagerName,
  todayReviewIso,
} from "@/lib/marketing-reviews-helpers";
import { buildRoleLabels, toStaffUserOptions } from "@/lib/staff-assignee-data";
import {
  getDailyReviewByDate,
  getDailyReviewDetail,
  getDailyReviews,
} from "@/services/marketing-reviews";
import { getRoles } from "@/services/roles";
import { listActiveUsers } from "@/services/users";
import { SupervisorDailyReviewClient } from "@/components/supervisor-daily-review-client";

export default async function DailyReviewSubmitPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (!(await hasPermission(user, PERMISSIONS.DAILY_REVIEW_SUBMIT))) {
    redirect(ROUTES.dashboard);
  }

  const managerName = spotCheckManagerName(user);
  const today = todayReviewIso();
  const [allReviews, todayRow, activeUsers, roles] = await Promise.all([
    getDailyReviews().catch(() => []),
    getDailyReviewByDate(today, managerName).catch(() => null),
    listActiveUsers().catch(() => []),
    getRoles().catch(() => []),
  ]);

  const mySubmissions = filterDailyReviewsByManager(allReviews, managerName);
  const todayReview = todayRow ? await getDailyReviewDetail(todayRow.id).catch(() => null) : null;

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <SupervisorDailyReviewClient
        initialSubmissions={mySubmissions}
        todayReview={todayReview}
        staffUsers={toStaffUserOptions(activeUsers)}
        roleLabels={buildRoleLabels(roles)}
      />
    </div>
  );
}
