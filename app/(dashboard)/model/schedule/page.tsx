export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getModelContext } from "@/lib/model-context-server";
import { ModelScheduleClient } from "@/components/model-schedule-client";
import { listModelScheduleItems, modelScheduleTimeOffItemToRequest } from "@/services/model-schedule";
import { getCurrentPeriod, getPeriodsForModel, getUpcomingPeriod } from "@/services/model-periods";
import { getModelTimeOffRequestsForRange } from "@/services/model-time-off-requests";
import { getThisWeekMonday, addDays, normalizeWeekStart, getTodayYmd } from "@/lib/weekly-program";
import { modelScheduleUrl } from "@/lib/routes";
import type { ModelTimeOffRequest } from "@/types";
import { Suspense } from "react";
import { ModelPeriodTrackerWidget } from "@/components/model-period-tracker-widget";
import { PeriodStatusBanner } from "@/components/period-status-banner";

function calendarDayDiffUtc(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd}T12:00:00.000Z`);
  const b = Date.parse(`${toYmd}T12:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86400000);
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
        <h1 className="text-xl font-semibold text-white">Availability</h1>
        <p className="text-white/70">Unable to load account context right now. Please try again.</p>
      </div>
    );
  }

  if (!linkedModelId || !modelRecord) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-white">Availability</h1>
        <p className="text-white/70">Your account must be linked to a model to manage availability.</p>
      </div>
    );
  }

  if (process.env.PERIOD_TRACKER_DEBUG === "true" || process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console -- gated schedule / period diagnostic
    console.log("[schedule] period_tracking_enabled:", modelRecord.period_tracking_enabled);
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

  let scheduleItems: Awaited<ReturnType<typeof listModelScheduleItems>> = [];
  let currentPeriod: Awaited<ReturnType<typeof getCurrentPeriod>> = null;
  let periodHistory: Awaited<ReturnType<typeof getPeriodsForModel>> = [];
  let timeOffRequests: Awaited<ReturnType<typeof getModelTimeOffRequestsForRange>> = [];
  let predictedPeriodStart: string | null = null;
  [scheduleItems, periodHistory, timeOffRequests, currentPeriod, predictedPeriodStart] = await Promise.all([
    listModelScheduleItems(linkedModelId, { fromDate: weekStart, toDate: weekEnd }).catch((error) => {
      console.error("[model/schedule] listModelScheduleItems failed; using [] fallback", error);
      return [];
    }),
    getPeriodsForModel(linkedModelId).catch((error) => {
      console.error("[model/schedule] getPeriodsForModel failed; using [] fallback", error);
      return [];
    }),
    getModelTimeOffRequestsForRange(linkedModelId, weekStart, weekEnd).catch((error) => {
      console.error("[model/schedule] getModelTimeOffRequestsForRange failed; using [] fallback", error);
      return [];
    }),
    getCurrentPeriod(linkedModelId, modelRecord).catch((error) => {
      console.error("[model/schedule] getCurrentPeriod failed; using null fallback", error);
      return null;
    }),
    getUpcomingPeriod(linkedModelId, modelRecord)
      .then((upcoming) => upcoming?.predicted_start ?? null)
      .catch((error) => {
        console.error("[model/schedule] getUpcomingPeriod failed; using null fallback", error);
        return null;
      }),
  ]);

  const timeOffFromSchedule = scheduleItems
    .filter((i) => i.item_type === "time_off")
    .map(modelScheduleTimeOffItemToRequest)
    .filter((x): x is ModelTimeOffRequest => x != null);
  const scheduleTimeOffIds = new Set(timeOffFromSchedule.map((r) => r.id));
  const mergedTimeOffRequests = [...timeOffFromSchedule, ...timeOffRequests.filter((t) => !scheduleTimeOffIds.has(t.id))];

  const todayYmd = getTodayYmd();
  const scheduleLastPeriod = periodHistory[0]?.start_date ?? null;
  const scheduleDaysUntilNext =
    predictedPeriodStart != null ? calendarDayDiffUtc(todayYmd, predictedPeriodStart) : null;
  const scheduleCurrentDay = currentPeriod?.day_number ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white md:text-2xl">Availability</h1>
        <p className="mt-1 text-sm text-white/60">
          Submit weekly availability and request time off. Scheduled program items and tasks are on Calendar.
        </p>
      </div>
      {modelRecord.period_tracking_enabled ? (
        <>
          <PeriodStatusBanner
            periodTrackingEnabled
            currentlyInPeriod={currentPeriod != null}
            currentPeriodDay={scheduleCurrentDay}
            lastPeriodDate={scheduleLastPeriod}
            nextExpectedDate={predictedPeriodStart}
            daysUntilNext={scheduleDaysUntilNext}
          />
          <ModelPeriodTrackerWidget
            modelRecordId={linkedModelId}
            stableModelId={modelRecord.model_id}
            periods={periodHistory}
            predictedNextStart={predictedPeriodStart}
            avgCycleLength={modelRecord.avg_cycle_length ?? null}
            avgPeriodLength={modelRecord.avg_period_length ?? null}
          />
        </>
      ) : null}
      <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-white/[0.04]" />}>
        <ModelScheduleClient
          modelId={linkedModelId}
          weekStart={weekStart}
          currentPeriod={currentPeriod}
          initialTimeOff={mergedTimeOffRequests}
          initialAction={initialAction}
          showProgramGrid={false}
        />
      </Suspense>
    </div>
  );
}
