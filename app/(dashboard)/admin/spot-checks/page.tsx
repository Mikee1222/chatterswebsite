import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { buildRoleLabels, filterVaUsers, toStaffUserOptions } from "@/lib/staff-assignee-data";
import { getSpotChecks } from "@/services/marketing-reviews";
import { listActiveModelsForAssignment } from "@/services/modelss";
import { getRoles } from "@/services/roles";
import { listActiveUsers } from "@/services/users";
import { AdminSpotChecksClient } from "@/components/admin-spot-checks-client";

export default async function AdminSpotChecksPage() {
  await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.SPOTCHECK_MANAGE);

  const [spotChecks, models, activeUsers, roles] = await Promise.all([
    getSpotChecks().catch(() => []),
    listActiveModelsForAssignment().catch(() => []),
    listActiveUsers().catch(() => []),
    getRoles().catch(() => []),
  ]);

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <AdminSpotChecksClient
        initialSpotChecks={spotChecks}
        vaUsers={filterVaUsers(activeUsers)}
        staffUsers={toStaffUserOptions(activeUsers)}
        roleLabels={buildRoleLabels(roles)}
        models={models}
      />
    </div>
  );
}
