import { getSessionFromCookies } from "@/lib/auth";
import { isAllowedDirectUploadToken } from "@/lib/direct-storage-upload";
import { resolveWardrobeAccess } from "@/lib/wardrobe-access";
import {
  createWardrobeItem,
  listWardrobe,
  setWardrobeRules,
  WARDROBE_KINDS,
  type WardrobeKind,
} from "@/services/model-wardrobe";

type Ctx = { params: Promise<{ modelId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { modelId: raw } = await ctx.params;
  const modelId = decodeURIComponent(raw ?? "").trim();
  const access = await resolveWardrobeAccess(session, modelId);
  if (!access.canView) return Response.json({ error: "Forbidden" }, { status: 403 });
  try {
    const bundle = await listWardrobe(modelId, { includeInactive: access.canEdit });
    return Response.json({ ...bundle, canEdit: access.canEdit });
  } catch (err) {
    console.error("[wardrobe] list failed", err);
    return Response.json({ error: "Could not load wardrobe" }, { status: 500 });
  }
}

/** POST { kind, name, tags, color, notes, photo_url } → new item. */
export async function POST(req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { modelId: raw } = await ctx.params;
  const modelId = decodeURIComponent(raw ?? "").trim();
  const access = await resolveWardrobeAccess(session, modelId);
  if (!access.canEdit) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    kind?: string;
    name?: string;
    tags?: string[];
    color?: string;
    notes?: string;
    photo_url?: string;
  };
  const kind = WARDROBE_KINDS.find((k) => k === body.kind) as WardrobeKind | undefined;
  if (!kind) return Response.json({ error: "kind must be outfit, location or prop" }, { status: 400 });
  const photo = (body.photo_url ?? "").trim();
  if (photo && !isAllowedDirectUploadToken(photo, "wardrobe-photo", { itemId: modelId })) {
    return Response.json({ error: "Invalid photo reference" }, { status: 400 });
  }
  if (!(body.name ?? "").trim() && !photo) {
    return Response.json({ error: "Add a name or a photo" }, { status: 400 });
  }
  try {
    const item = await createWardrobeItem(
      modelId,
      { kind, name: body.name, tags: body.tags, color: body.color, notes: body.notes, photo_url: photo },
      session.airtableUserId ?? session.id,
    );
    return Response.json({ item });
  } catch (err) {
    console.error("[wardrobe] create failed", err);
    return Response.json({ error: "Could not save item" }, { status: 500 });
  }
}

/** PATCH { rules } → agency rules for this creator's wardrobe. */
export async function PATCH(req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { modelId: raw } = await ctx.params;
  const modelId = decodeURIComponent(raw ?? "").trim();
  const access = await resolveWardrobeAccess(session, modelId);
  if (!access.canEdit) return Response.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { rules?: string };
  try {
    await setWardrobeRules(modelId, body.rules ?? "", session.airtableUserId ?? session.id);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[wardrobe] rules failed", err);
    return Response.json({ error: "Could not save rules" }, { status: 500 });
  }
}
