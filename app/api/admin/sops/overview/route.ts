import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getAcademyOverview } from "@/services/sop-academy-overview";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "sops:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const overview = await getAcademyOverview();
    return NextResponse.json(overview);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
