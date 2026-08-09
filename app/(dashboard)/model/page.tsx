export const dynamic = "force-dynamic";

import { getModelContext } from "@/lib/model-context-server";
import { MobileDashboardLayout } from "@/components/mobile-dashboard-layout";
import { ModelPeriodHomeStatusCard } from "@/components/model-period-home-status-card";
import { ModelHomeClient } from "@/components/model-home-client";
import { RouterRefreshInterval } from "@/components/router-refresh-interval";
import { ModelContentRequestsSection } from "@/components/model-content-requests-section";
import { ModelExpenseRequestsSection } from "@/components/model-expense-requests-section";
import { countApprovedCustomRequestsWaitingSchedule } from "@/services/custom-requests";
import { getActiveLiveStreamForModel } from "@/services/model-live-streams";
import { getCurrentPeriod, getUpcomingPeriod } from "@/services/model-periods";
import { listModelContentRequestsForModel } from "@/services/model-content-requests";
import { countPendingVAContentAssignmentsForModel } from "@/services/va-content-assignments";
import { loadModelHomeDashboardData } from "@/services/model-home-dashboard";
import type { ModelHomeDashboardData } from "@/services/model-home-dashboard";

const EMPTY_DASHBOARD: ModelHomeDashboardData = {
  earnings: {
    linked: false,
    monthGross: 0,
    previousGross: 0,
    pctChange: null,
    direction: "na",
    activeFans: null,
  },
  instagram: {
    linked: false,
    followers: null,
    engagementRate: null,
    followerDelta: null,
    topPostThumbUrl: null,
    topPostPermalink: null,
  },
  upcomingShoot: null,
  hero: {
    monthEarnings: null,
    earningsLinked: false,
    igFollowers: null,
    igLinked: false,
    nextShootLabel: null,
  },
  activity: [],
};

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
  let upcomingPeriod = null;
  let activeLiveRecord = null;
  let pendingCustomRequestsCount = 0;
  let pendingVaAssignmentsCount = 0;
  let contentRequests = [] as Awaited<ReturnType<typeof listModelContentRequestsForModel>>;
  let dashboard: ModelHomeDashboardData = EMPTY_DASHBOARD;

  [
    currentPeriod,
    upcomingPeriod,
    activeLiveRecord,
    pendingCustomRequestsCount,
    pendingVaAssignmentsCount,
    contentRequests,
    dashboard,
  ] = await Promise.all([
    getCurrentPeriod(linkedModelId, modelRecord).catch((error) => {
      console.error("[model/home] getCurrentPeriod failed; using null fallback", error);
      return null;
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
    countPendingVAContentAssignmentsForModel(linkedModelId, modelRecord.model_id).catch((error) => {
      console.error("[model/home] countPendingVAContentAssignmentsForModel failed; using 0 fallback", error);
      return 0;
    }),
    listModelContentRequestsForModel(linkedModelId).catch((error) => {
      console.error("[model/home] listModelContentRequestsForModel failed; using [] fallback", error);
      return [];
    }),
    loadModelHomeDashboardData(linkedModelId, modelRecord).catch((error) => {
      console.error("[model/home] loadModelHomeDashboardData failed; using empty fallback", error);
      return EMPTY_DASHBOARD;
    }),
  ]);

  const activeLive = activeLiveRecord
    ? {
        id: activeLiveRecord.id,
        platform: activeLiveRecord.platform,
        reason: activeLiveRecord.reason,
        reason_note: activeLiveRecord.reason_note,
        started_at:
          activeLiveRecord.actual_start?.trim() ||
          activeLiveRecord.planned_start?.trim() ||
          activeLiveRecord.created_at ||
          new Date().toISOString(),
      }
    : null;

  return (
    <MobileDashboardLayout>
      <RouterRefreshInterval intervalMs={60_000}>
        <div className="space-y-10 pb-6 md:space-y-12 md:pb-8">
          <ModelHomeClient
            displayName={displayName}
            userEmail={user.email}
            activeLive={activeLive}
            pendingCustomRequestsCount={pendingCustomRequestsCount}
            pendingVaAssignmentsCount={pendingVaAssignmentsCount}
            dashboard={dashboard}
          />

          {modelRecord.period_tracking_enabled === true ? (
            <ModelPeriodHomeStatusCard
              periodTrackingEnabled
              isInPeriod={currentPeriod != null}
              dayNumber={currentPeriod?.day_number ?? null}
              nextExpected={upcomingPeriod?.predicted_start ?? null}
            />
          ) : null}
          <ModelContentRequestsSection initialRequests={contentRequests} />
          <ModelExpenseRequestsSection />
        </div>
      </RouterRefreshInterval>
    </MobileDashboardLayout>
  );
}
