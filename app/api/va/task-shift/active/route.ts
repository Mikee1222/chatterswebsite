import { getSessionFromCookies } from "@/lib/auth";
import { jsonNoStore } from "@/lib/api-no-store";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { vaTypeAccessApiGuardForNavHref } from "@/lib/va-type-access";
import { getActiveVaTaskShift } from "@/services/shifts";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.VA_TASKS_VIEW))) {
    return jsonNoStore({ error: "Forbidden" }, { status: 403 });
  }
  const blocked = await vaTypeAccessApiGuardForNavHref(session, ROUTES.va.tasks);
  if (blocked) return blocked;

  const vaId = session.airtableUserId ?? session.id;
  const shift = await getActiveVaTaskShift(vaId);
  if (!shift) return jsonNoStore({ shift: null });

  return jsonNoStore({
    shift: {
      id: shift.id,
      start_time: shift.start_time,
      status: shift.status,
      break_started_at: shift.break_started_at,
      paused_seconds: shift.paused_seconds ?? 0,
      break_minutes: shift.break_minutes ?? 0,
    },
  });
}
