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
import { getEnabledTimerCategories } from "@/services/task-category-timer";
import { VaTasksClient } from "@/components/va-tasks-client";

/** Cap spawn work so a stuck/slow clone cannot hang the whole Tasks document forever. */
const SPAWN_BUDGET_MS = 6_000;

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
  // Materialize today's real recurring rows before render — marketing-exec / VA may open
  // /va-tasks without a shift-start, and day-boundary cron alone has left today as a locked
  // virtual "Upcoming day" preview when the real row was never created.
  // Soft time budget: spawn is now cheap when rows already exist; cloning Warm-Up (~76 items)
  // can still be heavy the first time — don't block HTML forever if Supabase stalls.
  await Promise.race([
    import("@/services/va-task-recurring-spawn")
      .then(({ spawnTodayRecurringOccurrencesForVa }) => spawnTodayRecurringOccurrencesForVa(vaId))
      .catch((err) => console.error("[va-tasks] spawn today recurring failed", err)),
    new Promise<void>((resolve) => setTimeout(resolve, SPAWN_BUDGET_MS)),
  ]);

  const [tasks, activeShift, enabledTimerCategories] = await Promise.all([
    getVaTasksForUser(vaId).catch(() => []),
    getActiveVaTaskShift(vaId).catch(() => null),
    getEnabledTimerCategories().catch(() => []),
  ]);

  // Intentionally do NOT SSR-hydrate full phase/item trees here.
  // Evidence (2026-09-29): a typical marketing VA with Warm-Up + Daily Marketing had
  // 202 checklist items (~115KB items JSON) + 137 historical tasks (~141KB) blocking
  // first paint; combined with spawn getPhasesByTask checks this made /va-tasks hang.
  // Client progressive prefetch after shell paint restores checked state without TTFB cost.

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
      enabledTimerCategories={enabledTimerCategories}
    />
  );
}
