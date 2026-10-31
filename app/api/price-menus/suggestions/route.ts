import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { acceptLinkSuggestion, dismissLinkSuggestion } from "@/services/price-menus";

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
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    if (body.action === "accept") {
      await acceptLinkSuggestion(id, actor(user));
      return NextResponse.json({ success: true });
    }
    if (body.action === "dismiss") {
      await dismissLinkSuggestion(id, actor(user));
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "action must be accept|dismiss" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
