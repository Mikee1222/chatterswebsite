import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission, requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { listActiveGunzoTeamModelss } from "@/services/modelss";
import { listCyclesWithStats } from "@/services/content-cycles";
import { ContentCyclesClient } from "@/components/content-cycles-client";

export default async function AdminContentCyclesPage() {
  const user = await getSessionFromCookies();
  await requireAdminRoute(user, PERMISSIONS.CONTENT_CYCLES_MANAGE);

  const canDeleteBunches = user
    ? await hasPermission(user, PERMISSIONS.WINNER_SOURCING_MANAGE)
    : false;

  const [models, cycles] = await Promise.all([
    listActiveGunzoTeamModelss().catch(() => []),
    listCyclesWithStats(null, 40).catch(() => []),
  ]);

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <ContentCyclesClient
        models={models.map((m) => ({ id: m.id, model_name: m.model_name }))}
        initialCycles={cycles}
        canDeleteBunches={canDeleteBunches}
      />
    </div>
  );
}
