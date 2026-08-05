import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { AdminInflowwPerformanceClient } from "@/components/admin-infloww-performance-client";
import {
  getAdminInflowwPerformanceReport,
  resolveInflowwStatsRange,
} from "@/services/infloww-performance";
import { listUsersWithInflowwEmployeeId } from "@/services/infloww-daily-stats";

export default async function AdminInflowwPerformancePage() {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.INFLOWW_STATS_VIEW_ALL))) {
    redirect(ROUTES.dashboard);
  }

  const range = resolveInflowwStatsRange("this_week");
  const [initial, linkedUsers] = await Promise.all([
    getAdminInflowwPerformanceReport(range, { includeRoi: true }),
    listUsersWithInflowwEmployeeId(),
  ]);

  return (
    <AdminInflowwPerformanceClient
      initial={initial}
      linkedUsers={linkedUsers.map((u) => ({
        id: u.publicId,
        name: u.full_name,
        employeeId: u.infloww_employee_id,
      }))}
    />
  );
}
