import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getAllWinnerVideos } from "@/services/winner-videos";
import { listActiveGunzoTeamModelss } from "@/services/modelss";
import { AdminWinnerVideosClient } from "@/components/admin-winner-videos-client";

export default async function AdminWinnerVideosPage() {
  await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.WINNER_VIDEOS_MANAGE);

  const [videos, gunzoModels] = await Promise.all([
    getAllWinnerVideos().catch(() => []),
    listActiveGunzoTeamModelss().catch(() => []),
  ]);

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <AdminWinnerVideosClient initialVideos={videos} gunzoModels={gunzoModels} />
    </div>
  );
}
