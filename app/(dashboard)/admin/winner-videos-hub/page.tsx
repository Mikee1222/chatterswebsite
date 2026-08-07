import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getWinnerSourcingRecreateConfig,
  listRecreationQueue,
  listVideoBunches,
  listWinnerSubmissions,
} from "@/services/winner-sourcing";
import { WinnerVideosHubClient } from "@/components/winner-videos-hub-client";

export default async function AdminWinnerVideosHubPage() {
  const user = await getSessionFromCookies();
  await requireAdminRoute(user, PERMISSIONS.WINNER_SOURCING_MANAGE);

  const [winners, superWinners, queue, bunches, recreateConfig] = await Promise.all([
    listWinnerSubmissions({ tier: "winner" }).catch(() => []),
    listWinnerSubmissions({ tier: "super_winner" }).catch(() => []),
    listRecreationQueue().catch(() => []),
    listVideoBunches().catch(() => []),
    getWinnerSourcingRecreateConfig().catch(() => ({
      winner_recreate_count: 3,
      super_winner_recreate_count: 10,
    })),
  ]);

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <WinnerVideosHubClient
        initialWinners={winners}
        initialSuperWinners={superWinners}
        initialQueue={queue}
        initialBunches={bunches}
        initialRecreateConfig={recreateConfig}
      />
    </div>
  );
}
