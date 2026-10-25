import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { listPersonasSummary } from "@/services/model-personas";
import { listLinkedModelIdsForUser } from "@/services/model-user-profiles";
import { listActiveGunzoTeamModelss } from "@/services/modelss";
import { PersonasListClient } from "@/components/personas-list-client";

export default async function PersonasPage() {
  const t0 = Date.now();
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);

  const canView = await hasPermission(user, PERMISSIONS.PERSONAS_VIEW);
  const canManage = await hasPermission(user, PERMISSIONS.PERSONAS_MANAGE);
  const canEditOwn = await hasPermission(user, PERMISSIONS.PERSONAS_EDIT_OWN);
  const canViewSensitive = await hasPermission(user, PERMISSIONS.PERSONAS_VIEW_SENSITIVE);
  if (!canView && !canManage && !canEditOwn) redirect(ROUTES.dashboard);

  const [summaries, models] = await Promise.all([
    listPersonasSummary().catch(() => []),
    listActiveGunzoTeamModelss().catch(() => []),
  ]);

  let allowed: Set<string> | null = null;
  if (!canView && !canManage && canEditOwn) {
    const linked = await listLinkedModelIdsForUser(user.airtableUserId ?? user.id);
    allowed = new Set(linked.modelIds);
  }

  const summaryByModel = new Map(summaries.map((s) => [s.model_id, s]));
  const rows = models
    .filter((m) => !allowed || allowed.has(m.id))
    .map((m) => ({
      model_id: m.id,
      model_name: m.model_name,
      team: m.team ?? "gunzo_team",
      summary: summaryByModel.get(m.id) ?? null,
    }))
    .sort((a, b) => a.model_name.localeCompare(b.model_name));

  // SSR timing for before/after reporting (server log only)
  console.info("[personas/list] ssr_ms", Date.now() - t0, "rows", rows.length);

  return <PersonasListClient rows={rows} canViewSensitive={canViewSensitive} />;
}
