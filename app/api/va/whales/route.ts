import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ROUTES } from "@/lib/routes";
import { vaTypeAccessApiGuardForNavHref } from "@/lib/va-type-access";
import { listAllWhales } from "@/services/whales";
import { buildWhalesFilterFormula, type WhalesListFilters } from "@/lib/whales-filters";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "whales:view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const blocked = await vaTypeAccessApiGuardForNavHref(session, ROUTES.va.whales);
  if (blocked) return blocked;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status")?.trim() || undefined;
  const chatterId = searchParams.get("chatter_id")?.trim() || undefined;
  const search = searchParams.get("search")?.trim() || undefined;

  const filters: WhalesListFilters = {
    status: status || undefined,
    chatterId: chatterId || undefined,
    usernameSearch: search || undefined,
  };
  const formula = buildWhalesFilterFormula(filters);
  let whales = await listAllWhales(formula).catch(() => []);
  if (filters.chatterId) {
    whales = whales.filter((w) => w.assigned_chatter_id === filters.chatterId);
  }

  return NextResponse.json({ whales });
}
