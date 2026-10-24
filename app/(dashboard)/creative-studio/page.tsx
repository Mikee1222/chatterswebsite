import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { listActiveGunzoTeamModelss } from "@/services/modelss";
import { listPostingBriefs } from "@/services/posting-briefs";
import { CreativeStudioClient } from "@/components/creative-studio-client";

export default async function CreativeStudioPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (!(await hasPermission(user, PERMISSIONS.CREATIVE_STUDIO_USE))) {
    redirect(ROUTES.dashboard);
  }

  const canPushBrief = await hasPermission(user, PERMISSIONS.POSTING_BRIEFS_MANAGE);

  const [models, briefs] = await Promise.all([
    listActiveGunzoTeamModelss().catch(() => []),
    canPushBrief
      ? listPostingBriefs({ status: "active" }).catch(() => [])
      : Promise.resolve([]),
  ]);

  return (
    <CreativeStudioClient
      models={models.map((m) => ({ id: m.id, model_name: m.model_name }))}
      briefs={briefs.map((b) => ({
        id: b.id,
        title: b.title,
        model_id: b.model_id,
      }))}
      canPushBrief={canPushBrief}
    />
  );
}
