import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { listCreatorStatusLog } from "@/services/infloww-creator-status-log";
import { listAllModelss } from "@/services/modelss";
import { CreatorStatusLogClient } from "@/components/creator-status-log-client";

export const dynamic = "force-dynamic";

export default async function AdminCreatorStatusLogPage() {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.INFLOWW_STATS_VIEW_ALL))) {
    redirect(ROUTES.dashboard);
  }

  const [entries, models] = await Promise.all([
    listCreatorStatusLog({ limit: 500 }),
    listAllModelss(),
  ]);

  const modelNameById = new Map(
    models.filter((m) => m.id && m.model_name).map((m) => [m.id, m.model_name!] as const)
  );

  return <CreatorStatusLogClient entries={entries} modelNameById={Object.fromEntries(modelNameById)} />;
}
