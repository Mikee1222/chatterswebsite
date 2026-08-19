import { redirect } from "next/navigation";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getProgramsForWeek, getProgramsForWeekAndChatter } from "@/services/weekly-program";
import { getCachedModelss } from "@/lib/modelss-cache";
import { addDays, parseWeekStart } from "@/lib/weekly-program";
import { getPeriodDatesByModelForWeek } from "@/services/model-periods";
import { ChatterWeeklyProgramClient } from "@/components/chatter-weekly-program-client";
import { getMondayOfWeekFromYmdAthens, getWeekStartYmdInAthens } from "@/lib/airtable-datetime";
import { toChatterTeamScheduleView } from "@/lib/weekly-program-chatter-view";

export default async function WeeklyProgramPage({
  searchParams,
}: {
  searchParams: { week_start?: string; view?: string };
}) {
  const user = await getSessionFromCookies();
  if (!user || getEffectiveStaffRole(user) !== "chatter") redirect(ROUTES.dashboard);

  const chatterId = user.airtableUserId ?? user.id;
  const rawWeek = searchParams.week_start?.trim();

  if (rawWeek && !parseWeekStart(rawWeek)) {
    redirect(ROUTES.chatter.weeklyProgram);
  }

  const weekStart = rawWeek ? getMondayOfWeekFromYmdAthens(rawWeek) : getWeekStartYmdInAthens(0);

  if (rawWeek && rawWeek.slice(0, 10) !== weekStart) {
    const params = new URLSearchParams();
    params.set("week_start", weekStart);
    if (searchParams.view) params.set("view", searchParams.view);
    redirect(`${ROUTES.chatter.weeklyProgram}?${params.toString()}`);
  }

  const [teamRaw, myEntries, modelss] = await Promise.all([
    getProgramsForWeek(weekStart).catch(() => []),
    getProgramsForWeekAndChatter(weekStart, chatterId).catch(() => []),
    getCachedModelss().catch(() => []),
  ]);

  const teamEntries = toChatterTeamScheduleView(teamRaw);

  const idToName: Record<string, string> = {};
  modelss.forEach((m) => {
    idToName[m.id] = m.model_name ?? m.id;
  });

  const weekEnd = addDays(weekStart, 6);
  const modelIdsForPeriods = Array.from(
    new Set([...teamEntries, ...myEntries].flatMap((e) => e.model_ids).filter(Boolean)),
  );
  const periodDatesByModelId =
    modelIdsForPeriods.length > 0
      ? await getPeriodDatesByModelForWeek(modelIdsForPeriods, weekStart, weekEnd).catch(
          () => ({}) as Record<string, string[]>,
        )
      : {};

  return (
    <ChatterWeeklyProgramClient
      weekStart={weekStart}
      chatterId={chatterId}
      teamEntries={teamEntries}
      myEntries={myEntries}
      idToName={idToName}
      periodDatesByModelId={periodDatesByModelId}
    />
  );
}
