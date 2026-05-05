import { getModelContext } from "@/lib/model-context-server";
import { ModelScheduleClient } from "@/components/model-schedule-client";
import { listModelScheduleItems } from "@/services/model-schedule";
import { listModelLiveStreams } from "@/services/model-live-streams";
import { getPeriodDatesForWeek, getCurrentPeriod } from "@/services/model-periods";
import { getThisWeekMonday, addDays } from "@/lib/weekly-program";
import { modelLiveStreamPlatformLabel } from "@/lib/airtable-options";
import type { ModelScheduleItem } from "@/types";

/** Merge model_schedule items and model_live_streams into one list so schedule shows both. */
function mergeScheduleWithLives(
  scheduleItems: ModelScheduleItem[],
  liveStreams: { id: string; model_id: string; date: string; planned_start: string | null; planned_end: string | null; platform: string; status: string; details: string; details_en: string | null; details_es: string | null; created_at: string; updated_at: string }[],
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

export default async function ModelSchedulePage({
  searchParams,
}: {
  searchParams?: { week?: string };
}) {
  const { linkedModelId, modelRecord, language } = await getModelContext();

  if (!linkedModelId || !modelRecord) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-white">Schedule</h1>
        <p className="text-white/70">Your account must be linked to a model to view your schedule.</p>
      </div>
    );
  }

  const weekParam = typeof searchParams?.week === "string" ? searchParams.week.trim().slice(0, 10) : "";
  const weekStart =
    /^\d{4}-\d{2}-\d{2}$/.test(weekParam) ? weekParam : getThisWeekMonday();
  const weekEnd = addDays(weekStart, 6);
  const fromDate = weekStart;
  const toDate = addDays(weekStart, 20);
  const [scheduleItems, liveStreams, periodDates, currentPeriod] = await Promise.all([
    listModelScheduleItems(linkedModelId, { fromDate, toDate }).catch(() => []),
    listModelLiveStreams(linkedModelId),
    getPeriodDatesForWeek(linkedModelId, weekStart, weekEnd).catch(() => [] as string[]),
    getCurrentPeriod(linkedModelId).catch(() => null),
  ]);
  const initialItems = mergeScheduleWithLives(scheduleItems, liveStreams, fromDate, toDate);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-white">Schedule</h1>
      <p className="text-sm text-white/60">Your program, scheduled customs, and live streams.</p>
      <ModelScheduleClient
        modelId={linkedModelId}
        language={language}
        initialItems={initialItems}
        weekStart={weekStart}
        periodDates={periodDates}
        currentPeriod={currentPeriod}
      />
    </div>
  );
}
