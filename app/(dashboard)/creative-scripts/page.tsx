import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { getScriptsQueue } from "@/services/winner-videos";
import { listActiveGunzoTeamModelss } from "@/services/modelss";
import { CreativeScriptsQueueClient } from "@/components/creative-scripts-queue-client";

export default async function CreativeScriptsPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (!(await hasPermission(user, PERMISSIONS.CREATIVE_SCRIPTS_SUBMIT))) {
    redirect(ROUTES.dashboard);
  }

  const [queue, gunzoModels] = await Promise.all([
    getScriptsQueue(user.airtableUserId ?? user.id).catch(() => []),
    listActiveGunzoTeamModelss().catch(() => []),
  ]);

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <CreativeScriptsQueueClient initialQueue={queue} gunzoModels={gunzoModels} />
    </div>
  );
}
