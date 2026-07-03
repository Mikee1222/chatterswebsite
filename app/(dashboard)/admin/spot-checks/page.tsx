import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getSpotChecks } from "@/services/marketing-reviews";
import { listAllModelss } from "@/services/modelss";
import { listAllUsers } from "@/services/users";
import { AdminSpotChecksClient } from "@/components/admin-spot-checks-client";

export default async function AdminSpotChecksPage() {
  await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.SPOTCHECK_MANAGE);

  const [spotChecks, models, allUsers] = await Promise.all([
    getSpotChecks().catch(() => []),
    listAllModelss().catch(() => []),
    listAllUsers().catch(() => []),
  ]);

  const vaUsers = allUsers.filter(
    (u) => u.role === "virtual_assistant" || u.secondary_role === "virtual_assistant",
  );

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <AdminSpotChecksClient initialSpotChecks={spotChecks} vaUsers={vaUsers} models={models} />
    </div>
  );
}
