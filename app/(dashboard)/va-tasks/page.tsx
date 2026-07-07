import { redirect } from "next/navigation";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getSessionFromCookies } from "@/lib/auth";
import { shouldUsePersonalVaTasksNav } from "@/lib/nav-config";
import { getUserPermissions } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { assertVaTypeCanAccessNavHref } from "@/lib/va-type-access";
import { getVaTasksForUser } from "@/services/va-tasks";
import { VaTasksClient } from "@/components/va-tasks-client";

export default async function VaTasksPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.dashboard);

  const isVa = getEffectiveStaffRole(user) === "virtual_assistant";
  if (isVa) {
    await assertVaTypeCanAccessNavHref(user, ROUTES.va.tasks);
  } else {
    const perms = await getUserPermissions(user);
    if (!shouldUsePersonalVaTasksNav(user.role, perms)) {
      if (perms.includes(PERMISSIONS.TASK_PROGRESS_VIEW)) {
        redirect(ROUTES.admin.vaTasks);
      }
      redirect(ROUTES.dashboard);
    }
  }

  const vaId = user.airtableUserId ?? user.id;
  const tasks = await getVaTasksForUser(vaId).catch(() => []);
  const userName = (user.fullName || user.email || "").trim();

  return <VaTasksClient tasks={tasks} userName={userName} />;
}
