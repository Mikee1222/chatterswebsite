import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { hasPermission } from "@/lib/rbac";
import { ROUTES } from "@/lib/routes";
import { vaTypeAccessApiGuardForNavHref } from "@/lib/va-type-access";
import { startVaTaskShiftAction } from "@/app/actions/shifts";

export async function POST() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "va-tasks:view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const blocked = await vaTypeAccessApiGuardForNavHref(session, ROUTES.va.tasks);
  if (blocked) return blocked;
  if (getEffectiveStaffRole(session) !== "virtual_assistant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await startVaTaskShiftAction();
    if ("error" in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, shiftId: result.shiftId });
  } catch (error) {
    console.error("[task-shift/start]", error);
    return NextResponse.json({ error: "Could not start shift" }, { status: 500 });
  }
}
