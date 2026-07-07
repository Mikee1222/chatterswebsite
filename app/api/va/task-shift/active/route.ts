import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { vaTypeAccessApiGuardForNavHref } from "@/lib/va-type-access";
import { getActiveVaTaskShift } from "@/services/shifts";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.VA_TASKS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const blocked = await vaTypeAccessApiGuardForNavHref(session, ROUTES.va.tasks);
  if (blocked) return blocked;

  const vaId = session.airtableUserId ?? session.id;
  const shift = await getActiveVaTaskShift(vaId);
  if (!shift) return NextResponse.json({ shift: null });

  return NextResponse.json({
    shift: {
      id: shift.id,
      start_time: shift.start_time,
      status: shift.status,
    },
  });
}
