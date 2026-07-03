import { getSessionFromCookies } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getUserPermissions, requireAdminRoute } from "@/lib/rbac";
import { getRoles, getRoleUserCounts } from "@/services/roles";
import { AdminRolesClient } from "./roles-client";

export default async function AdminRolesPage() {
  const session = await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.ROLES_MANAGE);

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
