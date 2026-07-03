import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { getMyScripts } from "@/services/winner-videos";
import { listActiveGunzoTeamModelss } from "@/services/modelss";
import { MyScriptsClient } from "@/components/my-scripts-client";

export default async function MyScriptsPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (!(await hasPermission(user, PERMISSIONS.CREATIVE_SCRIPTS_SUBMIT))) {
    redirect(ROUTES.dashboard);
  }

  const submitterId = (user.airtableUserId ?? user.id).trim();
  const [scripts, gunzoModels] = await Promise.all([
    getMyScripts(submitterId).catch(() => []),
    listActiveGunzoTeamModelss().catch(() => []),
  ]);

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <MyScriptsClient initialScripts={scripts} gunzoModels={gunzoModels} />
    </div>
  );
}
