import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { hasPermission } from "@/lib/rbac";
import { getMyProfilesData } from "@/services/my-profiles";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.MY_PROFILES_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await getMyProfilesData(session.airtableUserId ?? session.id);
  return NextResponse.json(data);
}
