import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { listLinkedModelIdsForUser } from "@/services/model-user-profiles";
import {
  applyPrefillWithoutOverwrite,
  buildPrefillHints,
  getOrCreatePersona,
  listLiveUpdates,
  listRevisions,
  savePersona,
  sectionDataFromPersona,
  stripSensitivePersona,
} from "@/services/model-personas";
import type { PersonaAiContextFlags, PersonaSectionData } from "@/lib/persona-types";

async function canAccessModel(
  session: NonNullable<Awaited<ReturnType<typeof getSessionFromCookies>>>,
  modelId: string,
): Promise<{ ok: boolean; canManage: boolean; canEditOwn: boolean; canViewSensitive: boolean }> {
  const canManage = await hasPermission(session, PERMISSIONS.PERSONAS_MANAGE);
  const canView = await hasPermission(session, PERMISSIONS.PERSONAS_VIEW);
  const canEditOwn = await hasPermission(session, PERMISSIONS.PERSONAS_EDIT_OWN);
  const canViewSensitive = await hasPermission(session, PERMISSIONS.PERSONAS_VIEW_SENSITIVE);

  if (canManage || canView) {
    return { ok: true, canManage, canEditOwn, canViewSensitive };
  }
  if (canEditOwn) {
    const linked = await listLinkedModelIdsForUser(session.airtableUserId ?? session.id);
    if (linked.modelIds.includes(modelId)) {
      return { ok: true, canManage: false, canEditOwn: true, canViewSensitive: false };
    }
  }
  return { ok: false, canManage: false, canEditOwn: false, canViewSensitive: false };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ modelId: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { modelId: raw } = await ctx.params;
  const modelId = decodeURIComponent(raw ?? "").trim();
  if (!modelId) return Response.json({ error: "Missing modelId" }, { status: 400 });

  const access = await canAccessModel(session, modelId);
  if (!access.ok) return Response.json({ error: "Forbidden" }, { status: 403 });

  const persona = await getOrCreatePersona(modelId);
  const hints = await buildPrefillHints(modelId);
  const base = persona.draft ?? sectionDataFromPersona(persona);
  const prefilled = applyPrefillWithoutOverwrite(base, hints);

  let out = persona;
  if (!access.canViewSensitive) {
    out = stripSensitivePersona(persona);
  }

  const [liveUpdates, revisions] = await Promise.all([
    listLiveUpdates(persona.id, { includeInactive: true }),
    listRevisions(persona.id, 15),
  ]);

  // Never return sensitive from draft if no permission
  let draftSections = prefilled;
  if (!access.canViewSensitive) {
    draftSections = { ...prefilled, physique: {}, intimate_details: {} };
  }

  return Response.json({
    persona: {
      ...out,
      // Editor works from draft/prefilled sections without leaking sensitive
      editor_sections: draftSections,
    },
    liveUpdates,
    revisions: revisions.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      saved_by_name: r.saved_by_name,
      // Omit snapshot content from list — fetch detail only if needed; keep ids only for privacy
    })),
    canManage: access.canManage,
    canEditOwn: access.canEditOwn,
    canViewSensitive: access.canViewSensitive,
    canEditSensitive: access.canManage && access.canViewSensitive,
    prefillApplied: Boolean(hints.name || hints.timezone || hints.handles?.length),
  });
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ modelId: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { modelId: raw } = await ctx.params;
  const modelId = decodeURIComponent(raw ?? "").trim();
  if (!modelId) return Response.json({ error: "Missing modelId" }, { status: 400 });

  const access = await canAccessModel(session, modelId);
  if (!access.ok) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!access.canManage && !access.canEditOwn) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    sections?: PersonaSectionData;
    ai_context_flags?: PersonaAiContextFlags;
    explicitSave?: boolean;
    draftOnly?: boolean;
  };

  if (!body.sections || typeof body.sections !== "object") {
    return Response.json({ error: "sections required" }, { status: 400 });
  }

  // edit_own: block sensitive writes
  const canEditSensitive = access.canManage && access.canViewSensitive;
  const sections = { ...body.sections };
  if (!canEditSensitive) {
    sections.physique = {};
    sections.intimate_details = {};
  }

  const saved = await savePersona({
    model_id: modelId,
    sections,
    ai_context_flags: body.ai_context_flags,
    explicitSave: body.explicitSave === true,
    draftOnly: body.draftOnly === true,
    userId: session.airtableUserId ?? session.id,
    userName: session.fullName ?? session.email ?? "User",
    canEditSensitive,
  });

  const out = canEditSensitive ? saved : stripSensitivePersona(saved);
  // Log only ids — never persona text
  console.info("[personas] save", {
    personaId: saved.id,
    modelId,
    draftOnly: body.draftOnly === true,
    explicitSave: body.explicitSave === true,
    userId: session.id,
  });

  return Response.json({ persona: out });
}
