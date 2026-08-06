import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { vaTypeAccessApiGuardForNavHref } from "@/lib/va-type-access";
import { startVaTaskShiftAction } from "@/app/actions/shifts";

export async function POST() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.VA_TASKS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const blocked = await vaTypeAccessApiGuardForNavHref(session, ROUTES.va.tasks);
  if (blocked) return blocked;

  try {
    const result = await startVaTaskShiftAction();
    if ("error" in result && result.error) {
      const status = result.error.toLowerCase().includes("already have an active") ? 409 : 400;
      return NextResponse.json(
        { error: result.error, shift: "shift" in result ? result.shift : undefined },
        { status },
      );
    }
    return NextResponse.json({
      success: true,
      shiftId: "shiftId" in result ? result.shiftId : undefined,
      shift: "shift" in result ? result.shift : undefined,
    });
  } catch (error) {
    console.error("[task-shift/start]", error);
    return NextResponse.json({ error: "Could not start shift" }, { status: 500 });
  }
}
