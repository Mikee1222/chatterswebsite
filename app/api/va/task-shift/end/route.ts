import { endVaTaskShiftAction } from "@/app/actions/shifts";
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

  const result = await endVaTaskShiftAction();
  if ("error" in result && result.error) {
    return jsonNoStore({ error: result.error }, { status: 400 });
  }
  return jsonNoStore({ success: true });
}
