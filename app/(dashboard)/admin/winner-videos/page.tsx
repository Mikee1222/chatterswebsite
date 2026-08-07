import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission, requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getAllWinnerVideos, getPendingScriptsForReview } from "@/services/winner-videos";
import { listActiveGunzoTeamModelss } from "@/services/modelss";
import { listUsersWithPermission } from "@/services/users";
import { listVideoBunches } from "@/services/winner-sourcing";
import { AdminWinnerVideosClient, type CreativeOption } from "@/components/admin-winner-videos-client";

export default async function AdminWinnerVideosPage() {
  const user = await getSessionFromCookies();
  await requireAdminRoute(user, PERMISSIONS.WINNER_VIDEOS_MANAGE);

  const canManageScripts = user ? await hasPermission(user, PERMISSIONS.CREATIVE_SCRIPTS_MANAGE) : false;
  const canAssignCreative = user ? await hasPermission(user, PERMISSIONS.WINNER_SOURCING_MANAGE) : false;

  const [videos, gunzoModels, pendingScripts, creativeUsers, bunches] = await Promise.all([
    getAllWinnerVideos().catch(() => []),
    listActiveGunzoTeamModelss().catch(() => []),
    canManageScripts ? getPendingScriptsForReview().catch(() => []) : Promise.resolve([]),
    listUsersWithPermission(PERMISSIONS.CREATIVE_SCRIPTS_SUBMIT).catch(() => []),
    listVideoBunches().catch(() => []),
  ]);

  const creatives: CreativeOption[] = creativeUsers
    .map((u) => ({
      id: u.id,
      name: (u.full_name || u.email || "").trim(),
      email: u.email || "",
      role: u.role || "other",
    }))
    .filter((c) => c.id && c.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <AdminWinnerVideosClient
        initialVideos={videos}
        initialPendingScripts={pendingScripts}
        initialBunches={bunches}
        gunzoModels={gunzoModels}
        creatives={creatives}
        canManageScripts={canManageScripts}
        canAssignCreative={canAssignCreative}
      />
    </div>
  );
}
