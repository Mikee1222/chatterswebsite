import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission, requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getAllWinnerVideos, getPendingScriptsForReview } from "@/services/winner-videos";
import { listActiveGunzoTeamModelss } from "@/services/modelss";
import { AdminWinnerVideosClient } from "@/components/admin-winner-videos-client";

export default async function AdminWinnerVideosPage() {
  const user = await getSessionFromCookies();
  await requireAdminRoute(user, PERMISSIONS.WINNER_VIDEOS_MANAGE);

  const canManageScripts = user ? await hasPermission(user, PERMISSIONS.CREATIVE_SCRIPTS_MANAGE) : false;

  const [videos, gunzoModels, pendingScripts] = await Promise.all([
    getAllWinnerVideos().catch(() => []),
    listActiveGunzoTeamModelss().catch(() => []),
    canManageScripts ? getPendingScriptsForReview().catch(() => []) : Promise.resolve([]),
  ]);

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <AdminWinnerVideosClient
        initialVideos={videos}
        initialPendingScripts={pendingScripts}
        gunzoModels={gunzoModels}
        canManageScripts={canManageScripts}
      />
    </div>
  );
}
