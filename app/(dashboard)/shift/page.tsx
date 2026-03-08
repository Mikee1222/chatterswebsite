import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getActiveShiftByChatter, getActiveShiftModels } from "@/services/shifts";
import { listAllModelss } from "@/services/modelss";
import { getProgramsForWeek } from "@/services/weekly-program";
import { getThisWeekMonday, getTodayWeekday, getTodayYmd } from "@/lib/weekly-program";
import { formatTimeFromISO } from "@/lib/format";
import { ShiftClient } from "@/components/shift-client";

const MAX_BREAK_MINUTES = 45;

export default async function ShiftPage() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "chatter") redirect(ROUTES.dashboard);

  const airtableUserId = user.airtableUserId ?? null;
  const internalUserId = user.id;
  const chatterId = airtableUserId ?? internalUserId;
  const chatterName = user.fullName ?? user.email ?? "Chatter";

  let activeShift: Awaited<ReturnType<typeof getActiveShiftByChatter>> = null;
  let modelss: Awaited<ReturnType<typeof listAllModelss>> = [];
  let shiftModels: Awaited<ReturnType<typeof getActiveShiftModels>> = [];
  let loadError = false;

  const todayYmd = getTodayYmd();
  const todayWeekday = getTodayWeekday();
  const weekStart = getThisWeekMonday();
  let todaySchedule: { todayYmd: string; todayWeekday: string; items: { timeRange: string; modelNames: string[] }[] } = {
    todayYmd,
    todayWeekday,
    items: [],
  };

  try {
    const [activeShiftResult, modelssResult, programsResult] = await Promise.all([
      getActiveShiftByChatter(chatterId),
      listAllModelss(),
      getProgramsForWeek(weekStart),
    ]);
    activeShift = activeShiftResult;
    modelss = modelssResult;
    if (activeShift) {
      shiftModels = await getActiveShiftModels(activeShift.id);
    }
    const programs = programsResult.filter((p) => p.chatter_id === chatterId && p.day === todayWeekday);
    const modelNameById = new Map(modelss.map((m) => [m.id, m.model_name]));
    todaySchedule = {
      todayYmd,
      todayWeekday,
      items: programs.map((p) => ({
        timeRange: `${formatTimeFromISO(p.start_time)} – ${formatTimeFromISO(p.end_time)}`,
        modelNames: p.model_ids.map((id) => modelNameById.get(id) ?? id).filter(Boolean),
      })),
    };
    console.log("[shift page] load", {
      currentUserAirtableRecordId: airtableUserId,
      currentUserInternalId: internalUserId,
      chatterIdUsedForQuery: chatterId,
      activeShiftFound: !!activeShift,
      activeShiftRecordId: activeShift?.id ?? null,
      activeShiftStatus: activeShift?.status ?? null,
      attachedModelsCount: shiftModels.length,
    });
  } catch (err) {
    loadError = true;
    console.error("[shift page] Airtable or load error – showing fallback", err);
  }

  return (
    <div className="min-h-0 space-y-8">
      {loadError && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Could not load shift data. Showing safe view — check server logs for details. You can try again or start a new shift.
        </div>
      )}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-white md:text-2xl md:text-3xl">Live operations</h1>
        <p className="mt-1 text-sm text-white/60">
          Run your shift, manage models, and take breaks (max {MAX_BREAK_MINUTES} min per shift).
        </p>
      </div>

      <ShiftClient
        chatterId={chatterId}
        chatterName={chatterName}
        activeShift={activeShift}
        shiftModels={shiftModels}
        modelss={modelss}
        maxBreakMinutes={MAX_BREAK_MINUTES}
        todaySchedule={todaySchedule}
      />
    </div>
  );
}
