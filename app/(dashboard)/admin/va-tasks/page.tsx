import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { shouldUsePersonalVaTasksNav } from "@/lib/nav-config";
import { getUserPermissions, hasAnyPermission, hasPermission, requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { addDaysAthensYmd } from "@/lib/airtable-datetime";
import {
  VA_TASKS_ADMIN_FETCH_FUTURE_DAYS,
  VA_TASKS_ADMIN_FETCH_PAST_DAYS,
} from "@/lib/va-tasks-airtable-formula";
import { getVaTasksViewTodayYmd } from "@/lib/va-task-date-filter";
import { getAllVaTasks } from "@/services/va-tasks";
import { listActiveModelsForAssignment } from "@/services/modelss";
import { listActiveUsers } from "@/services/users";
import { getRoles } from "@/services/roles";
import { AdminVaTasksClient } from "@/components/admin-va-tasks-client";

export default async function AdminVaTasksPage() {
  const user = await requireAdminRoute(await getSessionFromCookies());
  const perms = await getUserPermissions(user);
  const canAccessPage = await hasAnyPermission(user, [
    PERMISSIONS.VA_TASKS_MANAGE,
    PERMISSIONS.TASK_PROGRESS_VIEW,
  ]);
  if (!canAccessPage) redirect(ROUTES.dashboard);
  if (shouldUsePersonalVaTasksNav(user.role, perms)) redirect(ROUTES.va.tasks);
  const canManage = await hasPermission(user, PERMISSIONS.VA_TASKS_MANAGE);
  const canViewList = await hasPermission(user, PERMISSIONS.VA_TASKS_VIEW);
  const canViewProgress = await hasPermission(user, PERMISSIONS.TASK_PROGRESS_VIEW);

  const adminTodayYmd = getVaTasksViewTodayYmd();
  const athensStartYmd = addDaysAthensYmd(adminTodayYmd, -VA_TASKS_ADMIN_FETCH_PAST_DAYS);
  const athensEndYmd = addDaysAthensYmd(adminTodayYmd, VA_TASKS_ADMIN_FETCH_FUTURE_DAYS);
  // Same safety net as personal /va-tasks: ensure today's real recurring rows exist before
  // the board projects virtual "Upcoming day" previews for Athens today.
  await import("@/services/va-task-recurring-spawn")
    .then(({ spawnTodayRecurringOccurrencesAll }) => spawnTodayRecurringOccurrencesAll())
    .catch((err) => console.error("[admin/va-tasks] spawn today recurring failed", err));

  const [tasks, activeUsers, modelss, roles] = await Promise.all([
    getAllVaTasks({
      athensStartYmd,
      athensEndYmd,
    }),
    listActiveUsers(),
    listActiveModelsForAssignment().catch(() => []),
    getRoles().catch(() => []),
  ]);
  const vaUsers = activeUsers
    .filter((u) => u.role === "virtual_assistant" || u.secondary_role === "virtual_assistant")
    .map((u) => ({
      id: u.id,
      full_name: u.full_name ?? "",
      email: u.email ?? "",
    }));
  const staffUsers = activeUsers.map((u) => ({
    id: u.id,
    full_name: u.full_name ?? "",
    email: u.email ?? "",
    role: u.role ?? "",
  }));
  const roleLabels = Object.fromEntries(
    roles.map((r) => [r.role_id, r.label?.trim() || r.role_id.replace(/_/g, " ")]),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
      <AdminVaTasksClient
        tasks={tasks}
        vaUsers={vaUsers}
        staffUsers={staffUsers}
        roleLabels={roleLabels}
        modelss={modelss}
        canManage={canManage}
        canViewList={canViewList}
        canViewProgress={canViewProgress}
      />
    </div>
  );
}
