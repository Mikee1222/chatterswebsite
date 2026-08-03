import { redirect } from "next/navigation";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { unstable_cache } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { getNotificationUserId } from "@/lib/notification-user";
import { ROUTES } from "@/lib/routes";
import { getActiveShiftByChatter, getActiveShiftModels } from "@/services/shifts";
import { getProgramsForWeek } from "@/services/weekly-program";
import { getWeekStartYmdInAthens, getTodayWeekdayAthens, getTodayYmdAthens } from "@/lib/airtable-datetime";
import { formatTimeFromISO } from "@/lib/format";
import { ShiftClient } from "@/components/shift-client";
import { RouterRefreshInterval } from "@/components/router-refresh-interval";
import { getTodayYmd } from "@/lib/weekly-program";
import { listAllModelss } from "@/services/modelss";
import { listAllModelPeriods } from "@/services/model-periods";
import type { ModelRecord, OccupiedModelDetail } from "@/types";
import { devLog } from "@/lib/dev-log";

const MAX_BREAK_MINUTES = 45;

/** Dual-backed modelss list; cached 60s to cut backend volume on shift refreshes. */
const getCachedShiftPageModelss = unstable_cache(
  async (): Promise<ModelRecord[]> => {
    const records = await listAllModelss();
    return records.filter((m) => m.model_name?.trim() && m.model_id?.trim());
  },
  ["shift-page-modelss-dual-v1"],
  { revalidate: 60 }
);

export default async function ShiftPage() {
  const user = await getSessionFromCookies();
  if (!user || getEffectiveStaffRole(user) !== "chatter") redirect(ROUTES.dashboard);

  const airtableUserId = user.airtableUserId ?? null;
  const notificationUserId = getNotificationUserId(user);
  const chatterId = notificationUserId ?? "";
  devLog("[auth-debug] shift page", JSON.stringify({
    resolved_session_user_id: user.id,
    resolved_airtable_user_id: airtableUserId,
    resolved_notification_user_id: notificationUserId ?? null,
    route: "shift_page",
    chatterId_used: chatterId || "(empty)",
  }));
  const chatterName = user.fullName ?? user.email ?? "Chatter";

  let activeShift: Awaited<ReturnType<typeof getActiveShiftByChatter>> = null;
  let modelss: ModelRecord[] = [];
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
  let weeklyProgramModels: { id: string; name: string }[] = [];
  let occupiedModels: OccupiedModelDetail[] = [];

  try {
    const [activeShiftResult, modelssResult, programsResult] = await Promise.all([
      getActiveShiftByChatter(chatterId),
      getCachedShiftPageModelss(),
      getProgramsForWeek(weekStart),
    ]);
    activeShift = activeShiftResult;
    modelss = modelssResult;

    if (activeShift) {
      shiftModels = await getActiveShiftModels(activeShift.id);
    }

    const shiftModelIdSet = new Set(shiftModels.map((sm) => sm.model_id).filter(Boolean));
    if (shiftModelIdSet.size > 0) {
      const todayPeriodYmd = getTodayYmd();
      const periodRows = await listAllModelPeriods();
      const inPeriod = new Set<string>();
      for (const p of periodRows) {
        if (!p.start_date || !p.end_date) continue;
        if (p.start_date <= todayPeriodYmd && p.end_date >= todayPeriodYmd) {
          const mid = (p.model_id ?? "").trim();
          if (mid && shiftModelIdSet.has(mid)) inPeriod.add(mid);
        }
      }
      modelIdsInActivePeriodToday = Array.from(inPeriod);
    } else {
      modelIdsInActivePeriodToday = [];
    }

    const programs = programsResult.filter((p) => p.chatter_id === chatterId && p.day === todayWeekday);
    const modelNameById = new Map(modelss.map((m) => [m.id, m.model_name]));
    const seenProgramModel = new Set<string>();
    weeklyProgramModels = [];
    for (const p of programs) {
      for (const mid of p.model_ids) {
        if (!mid || seenProgramModel.has(mid)) continue;
        seenProgramModel.add(mid);
        weeklyProgramModels.push({ id: mid, name: modelNameById.get(mid) ?? mid });
      }
    }
    todaySchedule = {
      todayYmd,
      todayWeekday,
      items: programs.map((p) => ({
        timeRange: `${formatTimeFromISO(p.start_time)} – ${formatTimeFromISO(p.end_time)}`,
        modelNames: p.model_ids.map((id) => modelNameById.get(id) ?? id).filter(Boolean),
      })),
    };

    occupiedModels = modelss
      .filter((m) => m.current_status === "occupied")
      .map((m) => ({
        model_id: m.id,
        model_name: (m.model_name ?? "").trim() || "Model",
        chatter_name: (m.current_chatter_name ?? "").trim() || "Chatter",
        shift_id: (m.current_shift_id ?? "").trim(),
      }))
      .filter((o) => o.model_id && o.shift_id);

    devLog("[shift page] load", {
      currentUserAirtableRecordId: airtableUserId,
      currentUserInternalId: user.id,
      chatterIdUsedForQuery: chatterId || "(empty)",
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
    <RouterRefreshInterval intervalMs={60_000}>
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
          modelIdsInActivePeriodToday={modelIdsInActivePeriodToday}
          weeklyProgramModels={weeklyProgramModels}
          freeModelsForQueue={modelss.filter((m) => m.current_status === "free")}
          occupiedModels={occupiedModels}
        />
      </div>
    </RouterRefreshInterval>
  );
}
