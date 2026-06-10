import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ROUTES } from "@/lib/routes";
import { vaTypeAccessApiGuardForNavHref } from "@/lib/va-type-access";
import { getAccountsByVA } from "@/services/marketing";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "marketing:view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const blocked = await vaTypeAccessApiGuardForNavHref(session, ROUTES.va.marketingAccounts);
  if (blocked) return blocked;
  const vaId = session.airtableUserId ?? session.id;
  const { searchParams } = new URL(req.url);
  const modelId = searchParams.get("model_id")?.trim();
  let accounts = await getAccountsByVA(vaId);
  if (modelId) accounts = accounts.filter((a) => a.model_id === modelId);
  return NextResponse.json({ accounts });
}

