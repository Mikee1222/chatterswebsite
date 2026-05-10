import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getAccountsByVA } from "@/services/marketing";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session || getEffectiveStaffRole(session) !== "virtual_assistant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const vaId = session.airtableUserId ?? session.id;
  const accounts = await getAccountsByVA(vaId);
  return NextResponse.json({ accounts });
}
