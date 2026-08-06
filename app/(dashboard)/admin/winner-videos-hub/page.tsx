import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { listActiveGunzoTeamModelss } from "@/services/modelss";
import { listUsersWithPermission } from "@/services/users";
import {
  listRecreationQueue,
  listVideoBunches,
  listWinnerSubmissions,
} from "@/services/winner-sourcing";
import {
  WinnerVideosHubClient,
  type HubCreativeOption,
  type HubModelOption,
} from "@/components/winner-videos-hub-client";

export default async function AdminWinnerVideosHubPage() {
  const user = await getSessionFromCookies();
  await requireAdminRoute(user, PERMISSIONS.WINNER_SOURCING_MANAGE);

  const [winners, superWinners, queue, bunches, gunzoModels, creativeUsers] = await Promise.all([
    listWinnerSubmissions({ tier: "winner" }).catch(() => []),
    listWinnerSubmissions({ tier: "super_winner" }).catch(() => []),
    listRecreationQueue().catch(() => []),
    listVideoBunches().catch(() => []),
    listActiveGunzoTeamModelss().catch(() => []),
    listUsersWithPermission(PERMISSIONS.CREATIVE_SCRIPTS_SUBMIT).catch(() => []),
  ]);

  const models: HubModelOption[] = gunzoModels.map((m) => ({
    model_id: m.id || m.model_id,
    model_name: m.model_name || m.model_id || "Creator",
  }));

  const creatives: HubCreativeOption[] = creativeUsers
    .map((u) => ({ id: u.id, name: (u.full_name || u.email || "").trim() }))
    .filter((c) => c.id && c.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <WinnerVideosHubClient
        initialWinners={winners}
        initialSuperWinners={superWinners}
        initialQueue={queue}
        initialBunches={bunches}
        models={models}
        creatives={creatives}
      />
    </div>
  );
}
