import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { listActiveGunzoTeamModelss } from "@/services/modelss";
import { listPostingBriefs } from "@/services/posting-briefs";
import { listPersonasSummary } from "@/services/model-personas";
import { CreativeStudioClient } from "@/components/creative-studio-client";

export default async function CreativeStudioPage() {
  const t0 = Date.now();
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (!(await hasPermission(user, PERMISSIONS.CREATIVE_STUDIO_USE))) {
    redirect(ROUTES.dashboard);
  }

  const canPushBrief = await hasPermission(user, PERMISSIONS.POSTING_BRIEFS_MANAGE);
  const briefPerms = {
    editing: await hasPermission(user, PERMISSIONS.EDITING_BRIEFS_MANAGE),
    recording: await hasPermission(user, PERMISSIONS.RECORDING_BRIEFS_MANAGE),
    posting: canPushBrief,
  };
  const canViewPersonas =
    (await hasPermission(user, PERMISSIONS.PERSONAS_VIEW)) ||
    (await hasPermission(user, PERMISSIONS.PERSONAS_MANAGE)) ||
    (await hasPermission(user, PERMISSIONS.PERSONAS_EDIT_OWN));

  const [models, briefs, summaries] = await Promise.all([
    listActiveGunzoTeamModelss().catch(() => []),
    canPushBrief
      ? listPostingBriefs({ status: "active" }).catch(() => [])
      : Promise.resolve([]),
    // Meta only — no sensitive section content
    listPersonasSummary().catch(() => []),
  ]);

  console.info("[creative-studio] ssr_ms", Date.now() - t0, "models", models.length);

  return (
    <CreativeStudioClient
      models={models.map((m) => ({ id: m.id, model_name: m.model_name }))}
      briefs={briefs.map((b) => ({
        id: b.id,
        title: b.title,
        model_id: b.model_id,
      }))}
      canPushBrief={canPushBrief}
      canViewPersonas={canViewPersonas}
      briefPerms={briefPerms}
      personaMeta={summaries.map((s) => ({
        model_id: s.model_id,
        has_birth_date: s.has_birth_date,
        is_adult: s.is_adult,
        persona_type: s.persona_type,
        completeness: s.completeness,
        has_live_updates: s.has_live_updates,
      }))}
    />
  );
}
