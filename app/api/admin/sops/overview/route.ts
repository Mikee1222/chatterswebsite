import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getAcademyOverview } from "@/services/sop-academy-overview";

function isStaffAdmin(session: { role: string } | null): boolean {
  return session != null && (session.role === "admin" || session.role === "manager");
}

export async function GET() {
  const session = await getSessionFromCookies();
  if (!isStaffAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const overview = await getAcademyOverview();
    return NextResponse.json(overview);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
