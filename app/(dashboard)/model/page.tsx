import { getModelContext } from "@/lib/model-context-server";
import { MobileDashboardLayout } from "@/components/mobile-dashboard-layout";
import { ModelPeriodHomeSection } from "@/components/model-period-home-section";
import { ModelHomeClient } from "@/components/model-home-client";
import { countApprovedCustomRequestsWaitingSchedule } from "@/services/custom-requests";
import { getActiveLiveStreamForModel } from "@/services/model-live-streams";
import { getCurrentPeriod, getPeriodsForModel, getUpcomingPeriod } from "@/services/model-periods";
import { countPendingVAContentAssignmentsForModel } from "@/services/va-content-assignments";
import { Suspense } from "react";

export default async function ModelHomePage() {
  let user: Awaited<ReturnType<typeof getModelContext>>["user"] = null;
  let modelRecord: Awaited<ReturnType<typeof getModelContext>>["modelRecord"] = null;
  let linkedModelId: Awaited<ReturnType<typeof getModelContext>>["linkedModelId"] = null;
  try {
    ({ user, modelRecord, linkedModelId } = await getModelContext());
  } catch (error) {
    console.error("[model/home] getModelContext failed; rendering fallback", error);
    return (
      <MobileDashboardLayout>
        <div className="space-y-4">
          <h1 className="text-xl font-semibold text-white">Home</h1>
          <p className="text-white/70">Unable to load account context right now. Please try again.</p>
        </div>
      </MobileDashboardLayout>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-white">Home</h1>
        <p className="text-white/70">Please log in to view your home.</p>
      </div>
    );
  }

  if (!linkedModelId || !modelRecord) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-white">Home</h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Your account is not linked to a model profile. Contact an admin to link your account to a model.
        </p>
      </div>
    );
  }

  const displayName = modelRecord.model_name || user.fullName || "Model";

  let currentPeriod = null;
  let periods: Awaited<ReturnType<typeof getPeriodsForModel>> = [];
  let upcomingPeriod = null;
  let activeLiveRecord = null;
  let pendingCustomRequestsCount = 0;
  let pendingVaAssignmentsCount = 0;
  [
    currentPeriod,
    periods,
    upcomingPeriod,
    activeLiveRecord,
    pendingCustomRequestsCount,
    pendingVaAssignmentsCount,
  ] = await Promise.all([
    getCurrentPeriod(linkedModelId).catch((error) => {
      console.error("[model/home] getCurrentPeriod failed; using null fallback", error);
      return null;
    }),
    getPeriodsForModel(linkedModelId).catch((error) => {
      console.error("[model/home] getPeriodsForModel failed; using [] fallback", error);
      return [];
    }),
    getUpcomingPeriod(linkedModelId, modelRecord).catch((error) => {
      console.error("[model/home] getUpcomingPeriod failed; using null fallback", error);
      return null;
    }),
    getActiveLiveStreamForModel(linkedModelId).catch((error) => {
      console.error("[model/home] getActiveLiveStreamForModel failed; using null fallback", error);
      return null;
    }),
    countApprovedCustomRequestsWaitingSchedule(linkedModelId).catch((error) => {
      console.error("[model/home] countApprovedCustomRequestsWaitingSchedule failed; using 0 fallback", error);
      return 0;
    }),
    countPendingVAContentAssignmentsForModel(linkedModelId).catch((error) => {
      console.error("[model/home] countPendingVAContentAssignmentsForModel failed; using 0 fallback", error);
      return 0;
    }),
  ]);

  const activeLive = activeLiveRecord
    ? {
        id: activeLiveRecord.id,
        platform: activeLiveRecord.platform,
        started_at:
          activeLiveRecord.actual_start?.trim() ||
          activeLiveRecord.planned_start?.trim() ||
          activeLiveRecord.created_at ||
          new Date().toISOString(),
      }
    : null;

  const defaultLen =
    typeof modelRecord.avg_period_length === "number" && modelRecord.avg_period_length > 0
      ? Math.min(14, Math.round(modelRecord.avg_period_length))
      : 5;

  return (
    <MobileDashboardLayout>
      <div className="space-y-10 pb-6 md:space-y-12 md:pb-8">
        <ModelHomeClient
          displayName={displayName}
          userEmail={user.email}
          activeLive={activeLive}
          pendingCustomRequestsCount={pendingCustomRequestsCount}
          pendingVaAssignmentsCount={pendingVaAssignmentsCount}
        />

        <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-white/[0.04]" />}>
          <ModelPeriodHomeSection
            modelId={linkedModelId}
            currentPeriod={currentPeriod}
            predictedNextStart={upcomingPeriod?.predicted_start ?? null}
            periods={periods}
            defaultPeriodLengthDays={defaultLen}
          />
        </Suspense>
      </div>
    </MobileDashboardLayout>
  );
}
