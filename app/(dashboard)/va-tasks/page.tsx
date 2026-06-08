import { redirect } from "next/navigation";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { assertVaTypeCanAccessNavHref } from "@/lib/va-type-access";
import { getVaTasksForUser } from "@/services/va-tasks";
import { VaTasksClient } from "@/components/va-tasks-client";

export default async function VaTasksPage() {
  const user = await getSessionFromCookies();
  if (!user || getEffectiveStaffRole(user) !== "virtual_assistant") redirect(ROUTES.dashboard);
  await assertVaTypeCanAccessNavHref(user, ROUTES.va.tasks);

  const vaId = user.airtableUserId ?? user.id;
  const tasks = await getVaTasksForUser(vaId).catch(() => []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">My VA tasks</h1>
        <p className="mt-1 text-sm text-white/60">Tap a task to update status and add notes. Today is highlighted.</p>
      </div>
      <VaTasksClient tasks={tasks} />
    </div>
  );
}
