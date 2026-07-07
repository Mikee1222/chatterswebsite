import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getSpotChecks } from "@/services/marketing-reviews";
import { listActiveModelsForAssignment } from "@/services/modelss";
import { listActiveUsers } from "@/services/users";
import { AdminSpotChecksClient } from "@/components/admin-spot-checks-client";

export default async function AdminSpotChecksPage() {
  await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.SPOTCHECK_MANAGE);

  const [spotChecks, models, activeUsers] = await Promise.all([
    getSpotChecks().catch(() => []),
    listActiveModelsForAssignment().catch(() => []),
    listActiveUsers().catch(() => []),
  ]);

  const vaUsers = activeUsers.filter(
    (u) => u.role === "virtual_assistant" || u.secondary_role === "virtual_assistant",
  );

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <AdminSpotChecksClient initialSpotChecks={spotChecks} vaUsers={vaUsers} models={models} />
    </div>
  );
}
