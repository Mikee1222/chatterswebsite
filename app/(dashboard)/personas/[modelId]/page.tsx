import { redirect, notFound } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { listLinkedModelIdsForUser } from "@/services/model-user-profiles";
import { getModelById, listActiveGunzoTeamModelss } from "@/services/modelss";
import {
  applyPrefillWithoutOverwrite,
  buildPrefillHints,
  getOptionList,
  getOrCreatePersona,
  listLiveUpdates,
  listRevisions,
  sectionDataFromPersona,
  stripSensitivePersona,
} from "@/services/model-personas";
import { PersonaEditorClient } from "@/components/persona-editor-client";

export default async function PersonaEditorPage({
  params,
}: {
  params: Promise<{ modelId: string }>;
}) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);

  const { modelId: raw } = await params;
  const modelId = decodeURIComponent(raw ?? "").trim();
  if (!modelId) notFound();

  const canManage = await hasPermission(user, PERMISSIONS.PERSONAS_MANAGE);
  const canView = await hasPermission(user, PERMISSIONS.PERSONAS_VIEW);
  const canEditOwn = await hasPermission(user, PERMISSIONS.PERSONAS_EDIT_OWN);
  const canViewSensitive = await hasPermission(user, PERMISSIONS.PERSONAS_VIEW_SENSITIVE);

  if (!canManage && !canView && !canEditOwn) redirect(ROUTES.dashboard);

  if (!canManage && !canView && canEditOwn) {
    const linked = await listLinkedModelIdsForUser(user.airtableUserId ?? user.id);
    if (!linked.modelIds.includes(modelId)) redirect(ROUTES.personas);
  }

  const models = await listActiveGunzoTeamModelss().catch(() => []);
  let model = models.find((m) => m.id === modelId) ?? null;
  if (!model) {
    try {
      model = await getModelById(modelId);
    } catch {
      model = null;
    }
  }
  if (!model) notFound();

  const persona = await getOrCreatePersona(modelId);
  const hints = await buildPrefillHints(modelId);
  const base = persona.draft ?? sectionDataFromPersona(persona);
  let sections = applyPrefillWithoutOverwrite(base, hints);

  const canEditSensitive = canManage && canViewSensitive;
  if (!canViewSensitive) {
    sections = { ...sections, physique: {}, intimate_details: {} };
  }

  const displayPersona = canViewSensitive ? persona : stripSensitivePersona(persona);

  const [liveUpdates, revisions, personaTypes, chattingStrategies] = await Promise.all([
    listLiveUpdates(persona.id, { includeInactive: true }),
    listRevisions(persona.id, 15),
    getOptionList("persona_types"),
    getOptionList("chatting_strategies"),
  ]);

  const readOnly = !canManage && !canEditOwn;

  return (
    <PersonaEditorClient
      modelId={modelId}
      modelName={model.model_name}
      personaId={persona.id}
      initialSections={sections}
      aiContextFlags={displayPersona.ai_context_flags}
      lastUpdatedAt={displayPersona.updated_at}
      lastUpdatedByName={displayPersona.last_updated_by_name}
      liveUpdates={liveUpdates}
      revisions={revisions.map((r) => ({
        id: r.id,
        created_at: r.created_at,
        saved_by_name: r.saved_by_name,
      }))}
      personaTypes={personaTypes}
      chattingStrategies={chattingStrategies}
      canViewSensitive={canViewSensitive}
      canEditSensitive={canEditSensitive}
      canManage={canManage}
      readOnly={readOnly}
    />
  );
}
