import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ROUTES } from "@/lib/routes";
import { vaTypeAccessApiGuardForNavHref } from "@/lib/va-type-access";
import { getAccountsByVA, getFunnelsByModel, type FunnelLink } from "@/services/marketing";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "marketing:view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const blocked = await vaTypeAccessApiGuardForNavHref(session, ROUTES.va.marketingAccounts);
  if (blocked) return blocked;

  const vaId = session.airtableUserId ?? session.id;
  const accounts = await getAccountsByVA(vaId);
  const modelIds = [...new Set(accounts.map((a) => a.model_id?.trim()).filter(Boolean))] as string[];

  const perModel = await Promise.all(modelIds.map((id) => getFunnelsByModel(id)));
  const seen = new Set<string>();
  const funnels: FunnelLink[] = [];
  for (const list of perModel) {
    for (const f of list) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      funnels.push(f);
    }
  }

  return NextResponse.json({ funnels });
}
