import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { ROUTES } from "@/lib/routes";
import { getProgramsForWeekAndVa } from "@/services/weekly-program-va";
import { getVaTasksForUser } from "@/services/va-tasks";
import { getActiveShifts } from "@/services/shifts";
import { VaScheduleClient } from "@/components/va-schedule-client";
import { normalizeWeekStart } from "@/lib/weekly-program";

export default async function VaSchedulePage({ searchParams }: { searchParams?: Promise<{ week_start?: string }> }) {
  const session = await getSessionFromCookies();
  if (!session || getEffectiveStaffRole(session) !== "virtual_assistant") {
    redirect(ROUTES.va.home);
  }

  const userId = (session.airtableUserId ?? session.id)?.trim();
  if (!userId) redirect(ROUTES.va.home);

  const sp = searchParams ? await searchParams : undefined;
  const weekParam = sp?.week_start;
  const weekStart = normalizeWeekStart(typeof weekParam === "string" ? weekParam : undefined);

  const [weeklyProgram, tasks, activeAll] = await Promise.all([
    getProgramsForWeekAndVa(weekStart, userId).catch(() => []),
    getVaTasksForUser(userId).catch(() => []),
    getActiveShifts("virtual_assistant").catch(() => []),
  ]);

  const activeShifts = activeAll.filter((s) => s.chatter_id === userId);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
      <VaScheduleClient weeklyProgram={weeklyProgram} tasks={tasks} activeShifts={activeShifts} weekStart={weekStart} />
    </div>
  );
}
