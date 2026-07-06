import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { shouldUsePersonalVaTasksNav } from "@/lib/nav-config";
import { getUserPermissions, hasPermission, requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { getAllVaTasks } from "@/services/va-tasks";
import { listAllModelss } from "@/services/modelss";
import { listAllUsers } from "@/services/users";
import { AdminVaTasksClient } from "@/components/admin-va-tasks-client";

export default async function AdminVaTasksPage() {
  const user = await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.VA_TASKS_VIEW);
  const perms = await getUserPermissions(user);
  if (shouldUsePersonalVaTasksNav(user.role, perms)) redirect(ROUTES.va.tasks);
  const canManage = await hasPermission(user, PERMISSIONS.VA_TASKS_MANAGE);

  const [tasks, allUsers, modelss] = await Promise.all([
    getAllVaTasks(),
    listAllUsers(),
    listAllModelss().catch(() => []),
  ]);
  const vaUsers = allUsers
    .filter((u) => u.role === "virtual_assistant" || u.secondary_role === "virtual_assistant")
    .map((u) => ({
      id: u.id,
      full_name: u.full_name ?? "",
      email: u.email ?? "",
    }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
      <AdminVaTasksClient tasks={tasks} vaUsers={vaUsers} modelss={modelss} canManage={canManage} />
    </div>
  );
}
