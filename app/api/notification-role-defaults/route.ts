import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getNotificationDefaultsForRole } from "@/services/roles";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const roleParam = url.searchParams.get("role")?.trim();
  const role = roleParam || session.role;
  if (!role) return NextResponse.json({ error: "Missing role" }, { status: 400 });

  try {
    const defaults = await getNotificationDefaultsForRole(role);
    return NextResponse.json({ role, defaults });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
