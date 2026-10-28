import { getSessionFromCookies } from "@/lib/auth";
import { isAllowedDirectUploadToken } from "@/lib/direct-storage-upload";
import { resolveWardrobeAccess } from "@/lib/wardrobe-access";
import {
  deleteWardrobeItem,
  getWardrobeItem,
  updateWardrobeItem,
} from "@/services/model-wardrobe";

type Ctx = { params: Promise<{ modelId: string; itemId: string }> };

async function guard(ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  const { modelId: raw, itemId } = await ctx.params;
  const modelId = decodeURIComponent(raw ?? "").trim();
  const access = await resolveWardrobeAccess(session, modelId);
  if (!access.canEdit) return { error: Response.json({ error: "Forbidden" }, { status: 403 }) };
  const item = await getWardrobeItem(itemId);
  if (!item || item.model_id !== modelId) {
    return { error: Response.json({ error: "Not found" }, { status: 404 }) };
  }
  return { session, modelId, item };
}

export async function PATCH(req: Request, ctx: Ctx) {
  const g = await guard(ctx);
  if (g.error) return g.error;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    tags?: string[];
    color?: string;
    notes?: string;
    photo_url?: string;
    is_active?: boolean;
  };
  if (body.photo_url !== undefined) {
    const photo = body.photo_url.trim();
    if (photo && !isAllowedDirectUploadToken(photo, "wardrobe-photo", { itemId: g.modelId })) {
      return Response.json({ error: "Invalid photo reference" }, { status: 400 });
    }
  }
  try {
    const item = await updateWardrobeItem(g.item.id, body);
    return Response.json({ item });
  } catch (err) {
    console.error("[wardrobe] update failed", err);
    return Response.json({ error: "Could not update item" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const g = await guard(ctx);
  if (g.error) return g.error;
  try {
    await deleteWardrobeItem(g.item.id);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[wardrobe] delete failed", err);
    return Response.json({ error: "Could not delete item" }, { status: 500 });
  }
}
