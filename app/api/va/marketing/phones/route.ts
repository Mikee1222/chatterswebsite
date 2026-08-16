import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ROUTES } from "@/lib/routes";
import { vaTypeAccessApiGuardForNavHref } from "@/lib/va-type-access";
import { getPhonesByVA } from "@/services/marketing";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "marketing:view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const blocked = await vaTypeAccessApiGuardForNavHref(session, ROUTES.va.marketingAccounts);
  if (blocked) return blocked;

  const vaId = session.airtableUserId ?? session.id;
  const phones = await getPhonesByVA(vaId).catch(() => []);
  return NextResponse.json({ phones });
}
