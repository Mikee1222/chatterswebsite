import { redirect } from "next/navigation";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getSessionFromCookies } from "@/lib/auth";
import { qualifiesForAdminVaTasksNav } from "@/lib/nav-config";
import { getUserPermissions, hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { assertVaTypeCanAccessNavHref } from "@/lib/va-type-access";
import { getVaTasksForUser } from "@/services/va-tasks";
import { getActiveVaTaskShift } from "@/services/shifts";
import { VaTasksClient } from "@/components/va-tasks-client";

export default async function VaTasksPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.dashboard);

  const perms = await getUserPermissions(user);
  if (!perms.includes(PERMISSIONS.VA_TASKS_VIEW)) {
    redirect(ROUTES.dashboard);
  }
  // VAs always use the personal board — even when the role row also grants manage/progress
  // (common for "Managers Virtual Assistant"). Sending them to /admin/va-tasks loops through
  // requireAdminRoute → /dashboard.
  const staffRole = getEffectiveStaffRole(user);
  if (qualifiesForAdminVaTasksNav(perms) && staffRole !== "virtual_assistant") {
    redirect(ROUTES.admin.vaTasks);
  }

  if (staffRole === "virtual_assistant") {
    await assertVaTypeCanAccessNavHref(user, ROUTES.va.tasks);
  }

  const canManage = await hasPermission(user, PERMISSIONS.VA_TASKS_MANAGE);

  const vaId = user.airtableUserId ?? user.id;
  const [tasks, activeShift] = await Promise.all([
    getVaTasksForUser(vaId).catch(() => []),
    getActiveVaTaskShift(vaId).catch(() => null),
  ]);
  const userName = (user.fullName || user.email || "").trim();

  const initialActiveShift = activeShift
    ? {
        id: activeShift.id,
        start_time: activeShift.start_time ?? "",
        status: activeShift.status,
        break_started_at: activeShift.break_started_at,
        paused_seconds: activeShift.paused_seconds ?? 0,
        break_minutes: activeShift.break_minutes ?? 0,
      }
    : null;

  return (
    <VaTasksClient
      tasks={tasks}
      userName={userName}
      initialActiveShift={initialActiveShift}
      canManage={canManage}
    />
  );
}
