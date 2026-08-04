import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { ROUTES } from "@/lib/routes";
import { assertVaTypeCanAccessNavHref } from "@/lib/va-type-access";
import { normalizeWeekStartAthens } from "@/lib/airtable-datetime";
import { getProgramsForWeekVa } from "@/services/weekly-program-va";
import { getVaTasksForUser } from "@/services/va-tasks";
import { getActiveShifts } from "@/services/shifts";
import { getCachedModelss } from "@/lib/modelss-cache";
import { VaScheduleClient } from "@/components/va-schedule-client";

function norm(s: string | null | undefined): string {
  return (s ?? "").trim();
}

function matchesVaProgram(
  p: { chatter_id: string; chatter_name: string },
  airtableId: string | null | undefined,
  plainId: string,
  fullName: string | null | undefined,
  email: string | undefined
): boolean {
  const cid = norm(p.chatter_id);
  const cname = norm(p.chatter_name).toLowerCase();
  if (norm(airtableId) && cid === norm(airtableId)) return true;
  if (norm(plainId) && cid === norm(plainId)) return true;
  if (norm(fullName) && cname === norm(fullName).toLowerCase()) return true;
  if (norm(email) && cname === norm(email).toLowerCase()) return true;
  return false;
}

export default async function VaSchedulePage({ searchParams }: { searchParams?: Promise<{ week_start?: string }> }) {
  const session = await getSessionFromCookies();
  if (!session || getEffectiveStaffRole(session) !== "virtual_assistant") {
    redirect(ROUTES.va.home);
  }
  await assertVaTypeCanAccessNavHref(session, ROUTES.va.schedule);

  const userId = (session.airtableUserId ?? session.id)?.trim();
  if (!userId) redirect(ROUTES.va.home);

  const airtableId = session.airtableUserId;
  const plainId = session.id;

  const sp = searchParams ? await searchParams : undefined;
  const weekParam = sp?.week_start;
  const weekStart = normalizeWeekStartAthens(typeof weekParam === "string" ? weekParam : undefined);

  const [allWeeklyPrograms, tasks, activeAll, modelss] = await Promise.all([
    getProgramsForWeekVa(weekStart).catch(() => []),
    getVaTasksForUser(userId).catch(() => []),
    getActiveShifts("virtual_assistant").catch(() => []),
    getCachedModelss().catch(() => []),
  ]);

  const modelIdToName = Object.fromEntries(
    modelss.map((m) => [m.id, (m.model_name || "").trim() || m.id])
  );

  const weeklyProgram = allWeeklyPrograms.filter((p) =>
    matchesVaProgram(p, airtableId, plainId, session.fullName, session.email)
  );

  const activeShifts = activeAll.filter(
    (s) =>
      (norm(airtableId) && norm(s.chatter_id) === norm(airtableId)) ||
      (norm(plainId) && norm(s.chatter_id) === norm(plainId))
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
      <VaScheduleClient
        weeklyProgram={weeklyProgram}
        tasks={tasks}
        activeShifts={activeShifts}
        weekStart={weekStart}
        modelIdToName={modelIdToName}
      />
    </div>
  );
}
