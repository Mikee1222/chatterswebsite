import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { listLinkedModelIdsForUser } from "@/services/model-user-profiles";
import {
  createLiveUpdate,
  deleteLiveUpdate,
  getOrCreatePersona,
  listLiveUpdates,
  updateLiveUpdate,
} from "@/services/model-personas";

async function assertAccess(
  session: NonNullable<Awaited<ReturnType<typeof getSessionFromCookies>>>,
  modelId: string,
  write: boolean,
): Promise<boolean> {
  const canManage = await hasPermission(session, PERMISSIONS.PERSONAS_MANAGE);
  const canView = await hasPermission(session, PERMISSIONS.PERSONAS_VIEW);
  const canEditOwn = await hasPermission(session, PERMISSIONS.PERSONAS_EDIT_OWN);
  if (write) {
    if (canManage) return true;
    if (canEditOwn) {
      const linked = await listLinkedModelIdsForUser(session.airtableUserId ?? session.id);
      return linked.modelIds.includes(modelId);
    }
    return false;
  }
  if (canManage || canView) return true;
  if (canEditOwn) {
    const linked = await listLinkedModelIdsForUser(session.airtableUserId ?? session.id);
    return linked.modelIds.includes(modelId);
  }
  return false;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ modelId: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { modelId: raw } = await ctx.params;
  const modelId = decodeURIComponent(raw ?? "").trim();
  if (!(await assertAccess(session, modelId, false))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const persona = await getOrCreatePersona(modelId);
  const liveUpdates = await listLiveUpdates(persona.id, { includeInactive: true });
  return Response.json({ liveUpdates, personaId: persona.id });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ modelId: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { modelId: raw } = await ctx.params;
  const modelId = decodeURIComponent(raw ?? "").trim();
  if (!(await assertAccess(session, modelId, true))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    content?: string;
    status?: string;
    starts_at?: string;
    ends_at?: string;
  };
  if (!body.ends_at || !body.content?.trim()) {
    return Response.json({ error: "content and ends_at required" }, { status: 400 });
  }

  const persona = await getOrCreatePersona(modelId);
  try {
    const row = await createLiveUpdate({
      persona_id: persona.id,
      content: body.content.trim(),
      status: (body.status ?? "").trim(),
      starts_at: body.starts_at ?? new Date().toISOString(),
      ends_at: body.ends_at,
      userId: session.airtableUserId ?? session.id,
      userName: session.fullName ?? session.email ?? "User",
    });
    console.info("[personas] live-update create", { personaId: persona.id, liveUpdateId: row.id });
    return Response.json({ liveUpdate: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return Response.json({ error: msg }, { status: 400 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ modelId: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { modelId: raw } = await ctx.params;
  const modelId = decodeURIComponent(raw ?? "").trim();
  if (!(await assertAccess(session, modelId, true))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    content?: string;
    status?: string;
    starts_at?: string;
    ends_at?: string;
    is_live?: boolean;
    show_when_inactive?: boolean;
    delete?: boolean;
  };
  if (!body.id) return Response.json({ error: "id required" }, { status: 400 });

  if (body.delete) {
    await deleteLiveUpdate(body.id);
    console.info("[personas] live-update delete", { liveUpdateId: body.id, modelId });
    return Response.json({ ok: true });
  }

  const row = await updateLiveUpdate(body.id, {
    content: body.content,
    status: body.status,
    starts_at: body.starts_at,
    ends_at: body.ends_at,
    is_live: body.is_live,
    show_when_inactive: body.show_when_inactive,
  });
  return Response.json({ liveUpdate: row });
}
