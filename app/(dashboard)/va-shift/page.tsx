import { redirect } from "next/navigation";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getActiveShiftByStaff, getActiveShiftModels } from "@/services/shifts";
import { listAllModelss } from "@/services/modelss";
import { getProgramsForWeekVa } from "@/services/weekly-program-va";
import { getWeekStartYmdInAthens, getTodayWeekdayAthens, getTodayYmdAthens } from "@/lib/airtable-datetime";
import { formatTimeFromISO } from "@/lib/format";
import { VaShiftClient } from "@/components/va-shift-client";
import { RouterRefreshInterval } from "@/components/router-refresh-interval";
import { getCurrentPeriod } from "@/services/model-periods";

const MAX_BREAK_MINUTES = 45;

export default async function VaShiftPage() {
  const user = await getSessionFromCookies();
  if (!user || getEffectiveStaffRole(user) !== "virtual_assistant") redirect(ROUTES.dashboard);

  const vaId = user.airtableUserId ?? user.id;
  const vaName = user.fullName ?? user.email ?? "VA";

  let activeShift: Awaited<ReturnType<typeof getActiveShiftByStaff>> = null;
  let modelss: Awaited<ReturnType<typeof listAllModelss>> = [];
  let shiftModels: Awaited<ReturnType<typeof getActiveShiftModels>> = [];
  let loadError = false;
  const todayYmd = getTodayYmdAthens();
  const todayWeekday = getTodayWeekdayAthens();
  const weekStart = getWeekStartYmdInAthens(0);
  let todaySchedule: { todayYmd: string; todayWeekday: string; items: { timeRange: string; modelNames: string[] }[] } = {
    todayYmd,
    todayWeekday,
    items: [],
  };
  let modelIdsInActivePeriodToday: string[] = [];

  try {
    const [activeShiftResult, modelssResult, programsResult] = await Promise.all([
      getActiveShiftByStaff(vaId, "virtual_assistant"),
      listAllModelss(),
      getProgramsForWeekVa(weekStart),
    ]);
    activeShift = activeShiftResult;
    modelss = modelssResult;
    if (activeShift) {
      shiftModels = await getActiveShiftModels(activeShift.id);
    }
    modelIdsInActivePeriodToday = [];
    for (const sm of shiftModels) {
      if (!sm.model_id) continue;
      const cur = await getCurrentPeriod(sm.model_id).catch(() => null);
      if (cur) modelIdsInActivePeriodToday.push(sm.model_id);
    }
    const programs = programsResult.filter((p) => p.chatter_id === vaId && p.day === todayWeekday);
    const modelNameById = new Map(modelss.map((m) => [m.id, m.model_name]));
    todaySchedule = {
      todayYmd,
      todayWeekday,
      items: programs.map((p) => ({
        timeRange: `${formatTimeFromISO(p.start_time)} – ${formatTimeFromISO(p.end_time)}`,
        modelNames: p.model_ids.map((id) => modelNameById.get(id) ?? id).filter(Boolean),
      })),
    };
  } catch (err) {
    loadError = true;
    console.error("[va-shift page] load error", err);
  }

  return (
    <RouterRefreshInterval intervalMs={60_000}>
    <div className="min-h-0 space-y-8">
      {loadError && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Could not load shift data. Try again or start a new mistake shift.
        </div>
      )}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-white md:text-2xl md:text-3xl">Mistake shift</h1>
        <p className="mt-1 text-sm text-white/60">
          Fix the flow. Clean the mistakes. Max break {MAX_BREAK_MINUTES} min per shift.
        </p>
      </div>

      <VaShiftClient
        vaId={vaId}
        vaName={vaName}
        activeShift={activeShift}
        shiftModels={shiftModels}
        modelss={modelss}
        maxBreakMinutes={MAX_BREAK_MINUTES}
        todaySchedule={todaySchedule}
        modelIdsInActivePeriodToday={modelIdsInActivePeriodToday}
      />
    </div>
    </RouterRefreshInterval>
  );
}
