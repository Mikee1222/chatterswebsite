import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ModelScheduleClient } from "@/components/model-schedule-client";
import { LanguageProvider } from "@/lib/language-provider";
import { listModelScheduleItems } from "@/services/model-schedule";
import { listModelLiveStreams } from "@/services/model-live-streams";
import { getPeriodDatesForWeek, getCurrentPeriod, getUpcomingPeriod } from "@/services/model-periods";
import { listAllModelss } from "@/services/modelss";
import { getThisWeekMonday, addDays } from "@/lib/weekly-program";
import { modelLiveStreamPlatformLabel } from "@/lib/airtable-options";
import type { ModelLiveStreamRecord, ModelScheduleItem } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function mergeScheduleWithLives(
  scheduleItems: ModelScheduleItem[],
  liveStreams: ModelLiveStreamRecord[],
  fromDate: string,
  toDate: string
): ModelScheduleItem[] {
  const livesInRange = liveStreams.filter((s) => s.date >= fromDate && s.date <= toDate);
  const asItems: ModelScheduleItem[] = livesInRange.map((s) => ({
    id: s.id,
    model_id: s.model_id,
    title: s.platform ? `${modelLiveStreamPlatformLabel(s.platform)} live` : "Live stream",
    item_type: "live_stream",
    date: s.date,
    start_time: s.planned_start,
    end_time: s.planned_end,
    duration_minutes: null,
    priority: "",
    status: s.status,
    details: s.details,
    details_en: s.details_en,
    details_es: s.details_es,
    instructions: "",
    instructions_en: null,
    instructions_es: null,
    linked_custom_request_id: null,
    created_at: s.created_at,
    updated_at: s.updated_at,
  }));
  const combined = [...scheduleItems, ...asItems];
  combined.sort((a, b) => a.date.localeCompare(b.date) || (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  return combined;
}

export default async function AdminModelSchedulesPage({
  searchParams,
}: {
  searchParams?: { week?: string; model?: string };
}) {
  const user = await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.MODELS_SCHEDULES);

  const models = await listAllModelss().catch(() => []);
  const modelParam = typeof searchParams?.model === "string" ? searchParams.model.trim() : "";
  const modelId = modelParam && models.some((m) => m.id === modelParam) ? modelParam : models[0]?.id ?? "";

  if (!modelId) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="mb-6 text-3xl font-bold text-white">Model Schedules</h1>
        <p className="text-sm text-white/65">No models found. Add a modelss record first.</p>
      </div>
    );
  }

  const weekParam = typeof searchParams?.week === "string" ? searchParams.week.trim().slice(0, 10) : "";
  const weekStart = /^\d{4}-\d{2}-\d{2}$/.test(weekParam) ? weekParam : getThisWeekMonday();
  const weekEnd = addDays(weekStart, 6);
  const fromDate = weekStart;
  const toDate = addDays(weekStart, 20);
  const modelRecord = models.find((m) => m.id === modelId) ?? null;

  const [scheduleItems, liveStreams, periodDates, currentPeriod, upcoming] = await Promise.all([
    listModelScheduleItems(modelId, { fromDate, toDate }).catch(() => []),
    listModelLiveStreams(modelId),
    getPeriodDatesForWeek(modelId, weekStart, weekEnd).catch(() => [] as string[]),
    getCurrentPeriod(modelId, modelRecord).catch(() => null),
    getUpcomingPeriod(modelId, modelRecord).catch(() => null),
  ]);
  const predictedPeriodStart = upcoming?.predicted_start ?? null;
  const initialItems = mergeScheduleWithLives(scheduleItems, liveStreams, fromDate, toDate);

  return (
    <div className="container mx-auto p-6">
      <h1 className="mb-6 text-3xl font-bold text-white">Model Schedules</h1>
      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <label className="block text-sm text-white/70">
          <span className="mb-1 block">Model</span>
          <select
            name="model"
            defaultValue={modelId}
            className="min-h-11 min-w-[200px] rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.model_name || m.model_id || m.id}
              </option>
            ))}
          </select>
        </label>
        <input type="hidden" name="week" value={weekStart} />
        <button
          type="submit"
          className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/15"
        >
          Show schedule
        </button>
      </form>
      <LanguageProvider initialLanguage="en">
        <ModelScheduleClient
          modelId={modelId}
          initialItems={initialItems}
          weekStart={weekStart}
          periodDates={periodDates}
          predictedPeriodStart={predictedPeriodStart}
          currentPeriod={currentPeriod}
          initialAvailability={[]}
          initialTimeOff={[]}
          adminWeekNav
        />
      </LanguageProvider>
    </div>
  );
}
