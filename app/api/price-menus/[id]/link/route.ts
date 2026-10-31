import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { linkModels, unlinkModel } from "@/services/price-menus";

function actor(user: { id: string; fullName?: string | null; email?: string }) {
  return { id: user.id, name: user.fullName || user.email || user.id };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, PERMISSIONS.INFORMATIONS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id: menuId } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    if (body.action === "unlink" && typeof body.model_id === "string") {
      await unlinkModel(body.model_id, actor(user));
      return NextResponse.json({ success: true });
    }
    const modelIds = Array.isArray(body.model_ids) ? body.model_ids.map(String) : [];
    if (!modelIds.length) {
      return NextResponse.json({ error: "model_ids required" }, { status: 400 });
    }
    const result = await linkModels(menuId, modelIds, actor(user), {
      forceMove: body.force_move === true,
    });
    if (result.conflicts.length && !body.force_move) {
      return NextResponse.json({ ...result, needs_confirm: true }, { status: 409 });
    }
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Link failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
