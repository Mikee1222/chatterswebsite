import { redirect } from "next/navigation";
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
import { listAllRecords, type AirtableRecord } from "@/lib/airtable-server";
import { firstLinkedId } from "@/lib/airtable-linked";
import { getTodayYmd } from "@/lib/weekly-program";
import type { ModelRecord } from "@/types";
import { devLog } from "@/lib/dev-log";

const MAX_BREAK_MINUTES = 45;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type SlimModelFields = {
  model_name?: string;
  model_id?: string;
  current_status?: string;
  current_chatter?: unknown;
  current_chatter_name?: unknown;
};

function mapSlimModelToModelRecord(rec: AirtableRecord<SlimModelFields>): ModelRecord {
  const f = rec.fields;
  return {
    id: rec.id,
    model_id: typeof f.model_id === "string" && f.model_id ? f.model_id : rec.id,
    model_name: f.model_name ?? "",
    platform: "other",
    status: "",
    current_status: f.current_status === "occupied" ? "occupied" : "free",
    current_chatter_id: firstLinkedId(f.current_chatter) ?? "",
    current_chatter_name: typeof f.current_chatter_name === "string" ? f.current_chatter_name.trim() : "",
    current_shift_id: "",
    entered_at: null,
    last_chatter_id: "",
    last_chatter_name: "",
    last_exit_at: null,
    priority: "",
    notes: "",
    created_at: "",
    updated_at: "",
    avg_cycle_length: null,
    avg_period_length: null,
    period_notes: "",
  };
}

/** One slim modelss query; cached 60s to cut Airtable volume on shift refreshes. */
const getCachedShiftPageModelss = unstable_cache(
  async (): Promise<ModelRecord[]> => {
    const records = await listAllRecords<SlimModelFields>("modelss", {
      fields: ["model_name", "current_status", "current_chatter", "current_chatter_name", "model_id"],
    });
    return records.map(mapSlimModelToModelRecord);
  },
  ["shift-page-modelss-slim-v1"],
  { revalidate: 60 }
);

type PeriodFields = {
  model_id?: unknown;
  start_date?: string;
  end_date?: string;
};

export default async function ShiftPage() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "chatter") redirect(ROUTES.dashboard);

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

  try {
    activeShift = await getActiveShiftByChatter(chatterId);
    await sleep(500);

    modelss = await getCachedShiftPageModelss();
    await sleep(500);

    const programsResult = await getProgramsForWeek(weekStart);
    await sleep(500);

    if (activeShift) {
      shiftModels = await getActiveShiftModels(activeShift.id);
      await sleep(500);
    }

    const shiftModelIdSet = new Set(shiftModels.map((sm) => sm.model_id).filter(Boolean));
    if (shiftModelIdSet.size > 0) {
      const todayPeriodYmd = getTodayYmd();
      const periodFormula = `AND({start_date} <= "${todayPeriodYmd}", {end_date} >= "${todayPeriodYmd}")`;
      const periodRows = await listAllRecords<PeriodFields>("model_periods", {
        filterByFormula: periodFormula,
        fields: ["model_id", "start_date", "end_date"],
        _caller: "shiftPage.periodsForToday",
      });
      const inPeriod = new Set<string>();
      for (const rec of periodRows) {
        const mid = firstLinkedId(rec.fields.model_id);
        if (mid && shiftModelIdSet.has(mid)) inPeriod.add(mid);
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
        />
      </div>
    </RouterRefreshInterval>
  );
}
