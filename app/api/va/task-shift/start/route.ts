import { startVaTaskShiftAction } from "@/app/actions/shifts";
import { getSessionFromCookies } from "@/lib/auth";
import { jsonNoStore } from "@/lib/api-no-store";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { vaTypeAccessApiGuardForNavHref } from "@/lib/va-type-access";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSessionFromCookies();
  if (!session) return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.VA_TASKS_VIEW))) {
    return jsonNoStore({ error: "Forbidden" }, { status: 403 });
  }
  const blocked = await vaTypeAccessApiGuardForNavHref(session, ROUTES.va.tasks);
  if (blocked) return blocked;

  try {
    const result = await startVaTaskShiftAction();
    if ("error" in result && result.error) {
      const status = result.error.toLowerCase().includes("already have an active") ? 409 : 400;
      return jsonNoStore(
        { error: result.error, shift: "shift" in result ? result.shift : undefined },
        { status },
      );
    }
    return jsonNoStore({
      success: true,
      shiftId: "shiftId" in result ? result.shiftId : undefined,
      shift: "shift" in result ? result.shift : undefined,
    });
  } catch (error) {
    console.error("[task-shift/start]", error);
    return jsonNoStore({ error: "Could not start shift" }, { status: 500 });
  }
}
