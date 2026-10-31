import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  bulkAdjustPrices,
  duplicateMenu,
  fillNegotiationFromNormal,
  type PriceMarket,
} from "@/services/price-menus";

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
  const action = String(body.action ?? "");
  try {
    if (action === "adjust") {
      const mode = body.mode === "add" || body.mode === "subtract" ? body.mode : "percent";
      const target =
        body.target === "neg" || body.target === "both" ? body.target : "normal";
      const round_to =
        body.round_to === 5 || body.round_to === 10 || body.round_to === 1
          ? body.round_to
          : null;
      const result = await bulkAdjustPrices({
        menu_id: menuId,
        mode,
        amount: Number(body.amount) || 0,
        round_to,
        target,
        preview: body.preview === true,
        actor: actor(user),
      });
      return NextResponse.json(result);
    }
    if (action === "fill_neg") {
      const result = await fillNegotiationFromNormal(
        menuId,
        Number(body.percent) || 85,
        actor(user),
        body.preview === true
      );
      return NextResponse.json(result);
    }
    if (action === "duplicate") {
      const target_market: PriceMarket = body.target_market === "usa" ? "usa" : "greece";
      const menu = await duplicateMenu({
        source_menu_id: menuId,
        target_market,
        name: typeof body.name === "string" ? body.name : undefined,
        multiplier: body.multiplier != null ? Number(body.multiplier) : 1,
        round_to:
          body.round_to === 5 || body.round_to === 10 || body.round_to === 1
            ? body.round_to
            : null,
        translate_en: body.translate_en !== false,
        actor: actor(user),
      });
      return NextResponse.json(menu);
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Bulk failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
