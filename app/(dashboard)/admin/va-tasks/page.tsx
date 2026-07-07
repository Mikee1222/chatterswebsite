import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { shouldUsePersonalVaTasksNav } from "@/lib/nav-config";
import { getUserPermissions, hasAnyPermission, hasPermission, requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
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

  const [tasks, activeUsers, modelss, roles] = await Promise.all([
    getAllVaTasks(),
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
