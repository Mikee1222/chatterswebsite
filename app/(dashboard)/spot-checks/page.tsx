import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import {
  filterSpotChecksByManager,
  spotCheckManagerId,
  spotCheckManagerName,
} from "@/lib/marketing-reviews-helpers";
import { buildRoleLabels, toStaffUserOptions } from "@/lib/staff-assignee-data";
import { getSpotChecks } from "@/services/marketing-reviews";
import { listActiveModelsForAssignment } from "@/services/modelss";
import { getRoles } from "@/services/roles";
import { listActiveUsers } from "@/services/users";
import { SupervisorSpotChecksClient } from "@/components/supervisor-spot-checks-client";

export default async function SpotChecksSubmitPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (!(await hasPermission(user, PERMISSIONS.SPOTCHECK_SUBMIT))) {
    redirect(ROUTES.dashboard);
  }

  const managerName = spotCheckManagerName(user);
  const managerId = spotCheckManagerId(user);
  const [allSpotChecks, models, activeUsers, roles] = await Promise.all([
    getSpotChecks({ manager_id: managerId }).catch(() => []),
    listActiveModelsForAssignment().catch(() => []),
    listActiveUsers().catch(() => []),
    getRoles().catch(() => []),
  ]);

  const mySubmissions = filterSpotChecksByManager(allSpotChecks, managerName, managerId);

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <SupervisorSpotChecksClient
        initialSubmissions={mySubmissions}
        staffUsers={toStaffUserOptions(activeUsers)}
        roleLabels={buildRoleLabels(roles)}
        models={models}
      />
    </div>
  );
}
