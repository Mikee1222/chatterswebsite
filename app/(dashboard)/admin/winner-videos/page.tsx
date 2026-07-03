import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getAllWinnerVideos } from "@/services/winner-videos";
import { AdminWinnerVideosClient } from "@/components/admin-winner-videos-client";

export default async function AdminWinnerVideosPage() {
  await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.WINNER_VIDEOS_MANAGE);

  const videos = await getAllWinnerVideos().catch(() => []);

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <AdminWinnerVideosClient initialVideos={videos} />
    </div>
  );
}
