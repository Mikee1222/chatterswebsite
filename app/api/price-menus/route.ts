import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createMenu,
  getPriceMenusBundle,
  type PriceMarket,
} from "@/services/price-menus";

export async function GET(req: Request) {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, PERMISSIONS.INFORMATIONS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const includeInactive =
    url.searchParams.get("all") === "1" &&
    (await hasPermission(user, PERMISSIONS.INFORMATIONS_MANAGE));
  try {
    const bundle = await getPriceMenusBundle({ includeInactive });
    const canManage = await hasPermission(user, PERMISSIONS.INFORMATIONS_MANAGE);
    return NextResponse.json({ ...bundle, canManage });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, PERMISSIONS.INFORMATIONS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const o = (body ?? {}) as Record<string, unknown>;
  const name = String(o.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const market: PriceMarket = o.market === "usa" ? "usa" : "greece";
  try {
    const menu = await createMenu(
      {
        name,
        market,
        description: String(o.description ?? ""),
        is_active: o.is_active !== false,
        sort_order: Number(o.sort_order) || 0,
      },
      { id: user.id, name: user.fullName || user.email || user.id }
    );
    return NextResponse.json(menu);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
