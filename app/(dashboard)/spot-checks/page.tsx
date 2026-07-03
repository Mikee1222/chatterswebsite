import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { filterSpotChecksByManager, spotCheckManagerName } from "@/lib/marketing-reviews-helpers";
import { getSpotChecks } from "@/services/marketing-reviews";
import { listAllModelss } from "@/services/modelss";
import { listAllUsers } from "@/services/users";
import { SupervisorSpotChecksClient } from "@/components/supervisor-spot-checks-client";

export default async function SpotChecksSubmitPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (!(await hasPermission(user, PERMISSIONS.SPOTCHECK_SUBMIT))) {
    redirect(ROUTES.dashboard);
  }

  const managerName = spotCheckManagerName(user);
  const [allSpotChecks, models, allUsers] = await Promise.all([
    getSpotChecks().catch(() => []),
    listAllModelss().catch(() => []),
    listAllUsers().catch(() => []),
  ]);

  const mySubmissions = filterSpotChecksByManager(allSpotChecks, managerName);
  const vaUsers = allUsers.filter(
    (u) => u.role === "virtual_assistant" || u.secondary_role === "virtual_assistant",
  );

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <SupervisorSpotChecksClient
        initialSubmissions={mySubmissions}
        vaUsers={vaUsers}
        models={models}
      />
    </div>
  );
}
