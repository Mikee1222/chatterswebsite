export const dynamic = "force-dynamic";

import { getModelContext } from "@/lib/model-context-server";
import { listCustomRequestsByModel } from "@/services/custom-requests";
import { listModelTasks } from "@/services/model-tasks";
import { listVAContentAssignmentsForModel } from "@/services/va-content-assignments";
import { listModelScheduleItems } from "@/services/model-schedule";
import { ModelContentCalendarClient } from "@/components/model-content-calendar-client";
import { Suspense } from "react";
import { listModelPersonalEventsForModel } from "@/services/model-personal-events";
import { getCurrentPeriod, getPeriodsForModel, getUpcomingPeriod } from "@/services/model-periods";
import { getTodayYmd } from "@/lib/weekly-program";
import type { PeriodStatusBannerProps } from "@/components/period-status-banner";

function calendarDayDiffUtc(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd}T12:00:00.000Z`);
  const b = Date.parse(`${toYmd}T12:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86400000);
}

/**
 * Airtable `custom_requests.admin_status` uses **accepted** (not "approved") for admin-approved rows.
 * This page only includes customs with `admin_status === "accepted"`.
 */
export default async function ModelContentCalendarPage({
  searchParams,
}: {
  searchParams?: { action?: string };
}) {
  let user: Awaited<ReturnType<typeof getModelContext>>["user"] = null;
  let linkedModelId: Awaited<ReturnType<typeof getModelContext>>["linkedModelId"] = null;
  let modelRecord: Awaited<ReturnType<typeof getModelContext>>["modelRecord"] = null;
  try {
    ({ user, linkedModelId, modelRecord } = await getModelContext());
  } catch (error) {
    console.error("[model/content-calendar] getModelContext failed; rendering fallback", error);
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-white">Calendar</h1>
        <p className="text-white/70">Unable to load account context right now. Please try again.</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-white">Calendar</h1>
        <p className="text-white/70">Please log in to continue.</p>
      </div>
    );
  }

  if (!linkedModelId || !modelRecord) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-white">Calendar</h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Your account is not linked to a model profile. Contact an admin to link your account.
        </p>
      </div>
    );
  }

  let assignments: Awaited<ReturnType<typeof listVAContentAssignmentsForModel>> = [];
  let allCustoms: Awaited<ReturnType<typeof listCustomRequestsByModel>> = [];
  let tasks: Awaited<ReturnType<typeof listModelTasks>> = [];
  let personalEvents: Awaited<ReturnType<typeof listModelPersonalEventsForModel>> = [];
  // Filming shoots sync into model_schedule (content_shoot). Without this fetch they never
  // appear on /model/content-calendar (Availability keeps showProgramGrid=false).
  let scheduleItems: Awaited<ReturnType<typeof listModelScheduleItems>> = [];
  [
    assignments,
    allCustoms,
    tasks,
    personalEvents,
    scheduleItems,
  ] = await Promise.all([
    listVAContentAssignmentsForModel(linkedModelId, modelRecord.model_id).catch((error) => {
      console.error("[model/content-calendar] listVAContentAssignmentsForModel failed; using [] fallback", error);
      return [];
    }),
    listCustomRequestsByModel(linkedModelId).catch((error) => {
      console.error("[model/content-calendar] listCustomRequestsByModel failed; using [] fallback", error);
      return [];
    }),
    listModelTasks(linkedModelId).catch((error) => {
      console.error("[model/content-calendar] listModelTasks failed; using [] fallback", error);
      return [];
    }),
    listModelPersonalEventsForModel(linkedModelId).catch((error) => {
      console.error("[model/content-calendar] listModelPersonalEventsForModel failed; using [] fallback", error);
      return [];
    }),
    listModelScheduleItems(linkedModelId).catch((error) => {
      console.error("[model/content-calendar] listModelScheduleItems failed; using [] fallback", error);
      return [];
    }),
  ]);

  const customs = allCustoms.filter((c) => c.admin_status === "accepted");

  const modelName = modelRecord.model_name?.trim() || undefined;

  let periodBannerProps: PeriodStatusBannerProps | null = null;
  let loggedPeriodSpans: { start_date: string; end_date: string }[] = [];
  let activePeriodWindow: { start_date: string; end_date: string } | null = null;
  let predictedNextStart: string | null = null;

  if (modelRecord.period_tracking_enabled === true) {
    const [periodHistory, calendarCurrent, calendarUpcoming] = await Promise.all([
      getPeriodsForModel(linkedModelId).catch((error) => {
        console.error("[model/content-calendar] getPeriodsForModel failed; using [] fallback", error);
        return [];
      }),
      getCurrentPeriod(linkedModelId, modelRecord).catch((error) => {
        console.error("[model/content-calendar] getCurrentPeriod failed; using null fallback", error);
        return null;
      }),
      getUpcomingPeriod(linkedModelId, modelRecord).catch((error) => {
        console.error("[model/content-calendar] getUpcomingPeriod failed; using null fallback", error);
        return null;
      }),
    ]);
    loggedPeriodSpans = periodHistory.map((p) => ({ start_date: p.start_date, end_date: p.end_date }));
    predictedNextStart = calendarUpcoming?.predicted_start ?? null;
    activePeriodWindow =
      calendarCurrent != null
        ? { start_date: calendarCurrent.start_date, end_date: calendarCurrent.end_date }
        : null;
    const today = getTodayYmd();
    periodBannerProps = {
      periodTrackingEnabled: true,
      currentlyInPeriod: calendarCurrent != null,
      currentPeriodDay: calendarCurrent?.day_number ?? null,
      lastPeriodDate: periodHistory[0]?.start_date ?? null,
      nextExpectedDate: predictedNextStart,
      daysUntilNext: predictedNextStart != null ? calendarDayDiffUtc(today, predictedNextStart) : null,
    };
  }

  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-white/[0.04]" />}>
        <ModelContentCalendarClient
          assignments={assignments}
          customs={customs}
          tasks={tasks}
          personalEvents={personalEvents}
          scheduleItems={scheduleItems}
          modelName={modelName}
          openAddEventInitially={searchParams?.action === "add-personal-event"}
          periodBannerProps={periodBannerProps}
          loggedPeriodSpans={loggedPeriodSpans}
          activePeriodWindow={activePeriodWindow}
          predictedNextStart={predictedNextStart}
        />
      </Suspense>
    </div>
  );
}
