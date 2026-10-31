import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { deleteRow, reorderRows, upsertRow } from "@/services/price-menus";
import type { SpenderTier } from "@/services/pricing";

function actor(user: { id: string; fullName?: string | null; email?: string }) {
  return { id: user.id, name: user.fullName || user.email || user.id };
}

function coerceSt(v: unknown): SpenderTier {
  if (v === "medium_low") return "medium_low";
  if (v === "medium") return "medium";
  if (v === "low") return "low";
  return "high";
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
    if (body.action === "reorder" && Array.isArray(body.ordered_ids)) {
      const rows = await reorderRows(
        menuId,
        body.ordered_ids.map(String),
        actor(user)
      );
      return NextResponse.json({ rows });
    }
    if (body.action === "delete" && typeof body.row_id === "string") {
      await deleteRow(body.row_id, actor(user));
      return NextResponse.json({ success: true });
    }

    const level = Number(body.level);
    if (!Number.isFinite(level)) {
      return NextResponse.json({ error: "level required" }, { status: 400 });
    }
    const row = await upsertRow(
      {
        id: typeof body.id === "string" ? body.id : undefined,
        menu_id: menuId,
        spender_tier: coerceSt(body.spender_tier),
        level,
        price_min: body.price_min == null ? null : Number(body.price_min),
        price_max: body.price_max == null || body.price_max === "" ? null : Number(body.price_max),
        price_plus: body.price_plus === true,
        neg_min: body.neg_min == null || body.neg_min === "" ? null : Number(body.neg_min),
        neg_max: body.neg_max == null || body.neg_max === "" ? null : Number(body.neg_max),
        neg_text: body.neg_text == null ? null : String(body.neg_text),
        description: body.description != null ? String(body.description) : undefined,
        notes: body.notes != null ? String(body.notes) : undefined,
        is_active: body.is_active !== false,
        sort_order: body.sort_order != null ? Number(body.sort_order) : undefined,
      },
      actor(user)
    );
    return NextResponse.json(row);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Row save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
