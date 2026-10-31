import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { deleteSpecial, upsertSpecial } from "@/services/price-menus";

function actor(user: { id: string; fullName?: string | null; email?: string }) {
  return { id: user.id, name: user.fullName || user.email || user.id };
}

export async function POST(req: Request) {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, PERMISSIONS.INFORMATIONS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    if (body.action === "delete" && typeof body.id === "string") {
      await deleteSpecial(body.id, actor(user));
      return NextResponse.json({ success: true });
    }
    const label = String(body.label ?? "").trim();
    if (!label) return NextResponse.json({ error: "label required" }, { status: 400 });
    const special = await upsertSpecial(
      {
        id: typeof body.id === "string" ? body.id : undefined,
        label,
        price_min: body.price_min == null || body.price_min === "" ? null : Number(body.price_min),
        price_max: body.price_max == null || body.price_max === "" ? null : Number(body.price_max),
        price_plus: body.price_plus === true,
        neg_min: body.neg_min == null || body.neg_min === "" ? null : Number(body.neg_min),
        neg_max: body.neg_max == null || body.neg_max === "" ? null : Number(body.neg_max),
        neg_text: body.neg_text == null ? null : String(body.neg_text),
        description: body.description != null ? String(body.description) : undefined,
        applies_to_all: body.applies_to_all === true,
        is_active: body.is_active !== false,
        sort_order: body.sort_order != null ? Number(body.sort_order) : undefined,
        market:
          body.market === "usa" || body.market === "all" || body.market === "greece"
            ? body.market
            : "greece",
        model_ids: Array.isArray(body.model_ids) ? body.model_ids.map(String) : undefined,
      },
      actor(user)
    );
    return NextResponse.json(special);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
