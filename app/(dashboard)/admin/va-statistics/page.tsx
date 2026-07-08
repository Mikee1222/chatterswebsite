import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { AdminVaStatisticsClient } from "@/components/admin-va-statistics-client";
import { computeVaStatisticsReport, resolveVaStatisticsRange } from "@/services/va-statistics";

export default async function AdminVaStatisticsPage() {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.VA_STATISTICS_VIEW))) {
    redirect(ROUTES.dashboard);
  }

  const range = resolveVaStatisticsRange("this_week");
  const report = await computeVaStatisticsReport(range);

  return <AdminVaStatisticsClient initialReport={report} />;
}
