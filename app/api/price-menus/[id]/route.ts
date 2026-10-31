import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { archiveMenu, updateMenu, type PriceMarket } from "@/services/price-menus";

function actor(user: { id: string; fullName?: string | null; email?: string }) {
  return { id: user.id, name: user.fullName || user.email || user.id };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, PERMISSIONS.INFORMATIONS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    if (body.archive === true) {
      const menu = await archiveMenu(id, actor(user));
      return NextResponse.json(menu);
    }
    const patch: {
      name?: string;
      description?: string;
      is_active?: boolean;
      sort_order?: number;
      market?: PriceMarket;
    } = {};
    if (typeof body.name === "string") patch.name = body.name.trim();
    if (typeof body.description === "string") patch.description = body.description;
    if (typeof body.is_active === "boolean") patch.is_active = body.is_active;
    if (typeof body.sort_order === "number") patch.sort_order = body.sort_order;
    if (body.market === "usa" || body.market === "greece") patch.market = body.market;
    const menu = await updateMenu(id, patch, actor(user));
    return NextResponse.json(menu);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
