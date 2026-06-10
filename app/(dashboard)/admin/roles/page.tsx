import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { hasPermission, getUserPermissions } from "@/lib/rbac";
import { ROUTES } from "@/lib/routes";
import { getRoles, getRoleUserCounts } from "@/services/roles";
import { AdminRolesClient } from "./roles-client";

export default async function AdminRolesPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect(ROUTES.login);
  if (!(await hasPermission(session, PERMISSIONS.ROLES_MANAGE))) {
    redirect(ROUTES.admin.home);
  }

  const [roles, userCounts, grantablePermissions] = await Promise.all([
    getRoles().catch(() => []),
    getRoleUserCounts().catch(() => ({})),
    getUserPermissions(session).catch(() => []),
  ]);

  return (
    <AdminRolesClient
      initialRoles={roles}
      initialUserCounts={userCounts}
      grantablePermissions={grantablePermissions}
    />
  );
}
