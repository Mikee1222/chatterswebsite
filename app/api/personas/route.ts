import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { listPersonasSummary } from "@/services/model-personas";
import { listLinkedModelIdsForUser } from "@/services/model-user-profiles";
import { listActiveGunzoTeamModelss } from "@/services/modelss";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const canView = await hasPermission(session, PERMISSIONS.PERSONAS_VIEW);
  const canManage = await hasPermission(session, PERMISSIONS.PERSONAS_MANAGE);
  const canEditOwn = await hasPermission(session, PERMISSIONS.PERSONAS_EDIT_OWN);
  if (!canView && !canManage && !canEditOwn) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const [summaries, models] = await Promise.all([
    listPersonasSummary().catch(() => []),
    listActiveGunzoTeamModelss().catch(() => []),
  ]);

  let allowedModelIds: Set<string> | null = null;
  if (!canView && !canManage && canEditOwn) {
    const linked = await listLinkedModelIdsForUser(session.airtableUserId ?? session.id);
    allowedModelIds = new Set(linked.modelIds);
  }

  const summaryByModel = new Map(summaries.map((s) => [s.model_id, s]));
  const rows = models
    .filter((m) => !allowedModelIds || allowedModelIds.has(m.id))
    .map((m) => {
      const s = summaryByModel.get(m.id);
      return {
        model_id: m.id,
        model_name: m.model_name,
        persona_id: s?.id ?? null,
        updated_at: s?.updated_at ?? null,
        last_updated_by_name: s?.last_updated_by_name ?? null,
        has_birth_date: s?.has_birth_date ?? false,
      };
    });

  return Response.json({ models: rows });
}
