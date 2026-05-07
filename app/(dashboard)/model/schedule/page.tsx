export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getModelContext } from "@/lib/model-context-server";
import { ModelScheduleClient } from "@/components/model-schedule-client";
import { listModelScheduleItems } from "@/services/model-schedule";
import { listModelLiveStreams } from "@/services/model-live-streams";
import { getCurrentPeriod, getPeriodDatesForWeek, getPeriodsForModel, getUpcomingPeriod } from "@/services/model-periods";
import { getModelAvailabilityRequestsForWeek } from "@/services/weekly-availability-requests-models";
import { getModelTimeOffRequestsForRange } from "@/services/model-time-off-requests";
import { getThisWeekMonday, addDays, normalizeWeekStart } from "@/lib/weekly-program";
import { modelLiveStreamPlatformLabel } from "@/lib/airtable-options";
import { modelScheduleUrl } from "@/lib/routes";
import type { ModelScheduleItem } from "@/types";
import { Suspense } from "react";
import { ModelRouteEmptyState } from "@/components/model-route-feedback";
import { ModelPeriodTrackerWidget } from "@/components/model-period-tracker-widget";

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
  searchParams?: { week_start?: string; week?: string; action?: string };
}) {
  let linkedModelId: Awaited<ReturnType<typeof getModelContext>>["linkedModelId"] = null;
  let modelRecord: Awaited<ReturnType<typeof getModelContext>>["modelRecord"] = null;
  try {
    ({ linkedModelId, modelRecord } = await getModelContext());
  } catch (error) {
    console.error("[model/schedule] getModelContext failed; rendering fallback", error);
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-white">Schedule</h1>
        <p className="text-white/70">Unable to load account context right now. Please try again.</p>
      </div>
    );
  }

  if (!linkedModelId || !modelRecord) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-white">Schedule</h1>
        <p className="text-white/70">Your account must be linked to a model to view your schedule.</p>
      </div>
    );
  }

  const rawWeek =
    typeof searchParams?.week_start === "string"
      ? searchParams.week_start.trim()
      : typeof searchParams?.week === "string"
        ? searchParams.week.trim().slice(0, 10)
        : "";
  const weekStart = normalizeWeekStart(rawWeek || getThisWeekMonday());
  const actionRaw = typeof searchParams?.action === "string" ? searchParams.action.trim() : "";
  const initialAction = actionRaw === "submit" || actionRaw === "request-off" ? actionRaw : null;

  if (rawWeek && rawWeek !== weekStart) {
    redirect(modelScheduleUrl({ weekStart, action: initialAction ?? undefined }));
  }

  const weekEnd = addDays(weekStart, 6);
  const fromDate = weekStart;
  const toDate = addDays(weekStart, 20);
  let scheduleItems: ModelScheduleItem[] = [];
  let liveStreams: Awaited<ReturnType<typeof listModelLiveStreams>> = [];
  let periodDates: string[] = [];
  let currentPeriod: Awaited<ReturnType<typeof getCurrentPeriod>> = null;
  let predictedPeriodStart: string | null = null;
  let periodHistory: Awaited<ReturnType<typeof getPeriodsForModel>> = [];
  let availabilityRequests: Awaited<ReturnType<typeof getModelAvailabilityRequestsForWeek>> = [];
  let timeOffRequests: Awaited<ReturnType<typeof getModelTimeOffRequestsForRange>> = [];
  [
    scheduleItems,
    liveStreams,
    periodDates,
    currentPeriod,
    periodHistory,
    availabilityRequests,
    timeOffRequests,
    predictedPeriodStart,
  ] = await Promise.all([
    listModelScheduleItems(linkedModelId, { fromDate, toDate }).catch((error) => {
      console.error("[model/schedule] listModelScheduleItems failed; using [] fallback", error);
      return [];
    }),
    listModelLiveStreams(linkedModelId).catch((error) => {
      console.error("[model/schedule] listModelLiveStreams failed; using [] fallback", error);
      return [];
    }),
    getPeriodDatesForWeek(linkedModelId, weekStart, weekEnd).catch((error) => {
      console.error("[model/schedule] getPeriodDatesForWeek failed; using [] fallback", error);
      return [];
    }),
    getCurrentPeriod(linkedModelId).catch((error) => {
      console.error("[model/schedule] getCurrentPeriod failed; using null fallback", error);
      return null;
    }),
    getPeriodsForModel(linkedModelId).catch((error) => {
      console.error("[model/schedule] getPeriodsForModel failed; using [] fallback", error);
      return [];
    }),
    getModelAvailabilityRequestsForWeek(weekStart, linkedModelId).catch((error) => {
      console.error("[model/schedule] getModelAvailabilityRequestsForWeek failed; using [] fallback", error);
      return [];
    }),
    getModelTimeOffRequestsForRange(linkedModelId, weekStart, weekEnd).catch((error) => {
      console.error("[model/schedule] getModelTimeOffRequestsForRange failed; using [] fallback", error);
      return [];
    }),
    getUpcomingPeriod(linkedModelId, modelRecord)
      .then((upcoming) => upcoming?.predicted_start ?? null)
      .catch((error) => {
        console.error("[model/schedule] getUpcomingPeriod failed; using null fallback", error);
        return null;
      }),
  ]);
  const initialItems = mergeScheduleWithLives(scheduleItems, liveStreams, fromDate, toDate);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-white">Schedule</h1>
      <p className="text-sm text-white/60">
        Your program, scheduled customs, live streams, weekly availability, and time-off requests.
      </p>
      {modelRecord.period_tracking_enabled ? (
        <ModelPeriodTrackerWidget
          periods={periodHistory}
          predictedNextStart={predictedPeriodStart}
          avgCycleLength={modelRecord.avg_cycle_length ?? null}
          avgPeriodLength={modelRecord.avg_period_length ?? null}
        />
      ) : null}
      {initialItems.length === 0 && availabilityRequests.length === 0 && timeOffRequests.length === 0 ? (
        <ModelRouteEmptyState
          title="No schedule items yet"
          description="Your upcoming schedule is empty for now. You can still submit weekly availability or request time off."
        />
      ) : null}
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-white/[0.04]" />}>
        <ModelScheduleClient
          modelId={linkedModelId}
          initialItems={initialItems}
          weekStart={weekStart}
          periodDates={periodDates}
          predictedPeriodStart={predictedPeriodStart}
          currentPeriod={currentPeriod}
          initialAvailability={availabilityRequests}
          initialTimeOff={timeOffRequests}
          initialAction={initialAction}
        />
      </Suspense>
    </div>
  );
}
