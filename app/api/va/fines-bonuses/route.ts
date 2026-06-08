import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { ROUTES } from "@/lib/routes";
import { vaTypeAccessApiGuardForNavHref } from "@/lib/va-type-access";
import { getFinesBonusesForUser } from "@/services/fines-bonuses";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session || getEffectiveStaffRole(session) !== "virtual_assistant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const blocked = await vaTypeAccessApiGuardForNavHref(session, ROUTES.finesBonuses);
  if (blocked) return blocked;
  const userId = (session.airtableUserId ?? session.id)?.trim();
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const entries = await getFinesBonusesForUser(userId);
    return NextResponse.json({ entries });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
