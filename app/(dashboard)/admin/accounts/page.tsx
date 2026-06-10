import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { listAllUsers } from "@/services/users";
import { listAllModelss } from "@/services/modelss";
import { getRoles } from "@/services/roles";
import { redirect } from "next/navigation";
import { AccountsView, type AccountStats } from "@/components/accounts-view";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import type { UserRecord } from "@/types";

function computeStats(users: UserRecord[], customRoleIds: Set<string>): AccountStats {
  let chatters = 0;
  let vas = 0;
  let customRoles = 0;
  for (const u of users) {
    if (u.role === "chatter") chatters++;
    else if (u.role === "virtual_assistant") vas++;
    else if (customRoleIds.has(u.role)) customRoles++;
  }
  return { total: users.length, chatters, vas, customRoles };
}

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string; section?: string; role?: string }>;
}) {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.ACCOUNTS_VIEW))) redirect(ROUTES.dashboard);

  const [users, modelss, roles, params, canCreate] = await Promise.all([
    listAllUsers().catch(() => []),
    listAllModelss().catch(() => []),
    getRoles().catch(() => []),
    searchParams,
    hasPermission(user, PERMISSIONS.ACCOUNTS_CREATE),
  ]);
  const { success, error } = params;

  const customRoleIds = new Set(roles.filter((r) => !r.is_system_role).map((r) => r.role_id));
  const stats = computeStats(users, customRoleIds);

  return (
    <AccountsView
      users={users}
      modelss={modelss}
      roles={roles}
      stats={stats}
      canCreate={canCreate}
      success={success}
      error={error}
    />
  );
}
