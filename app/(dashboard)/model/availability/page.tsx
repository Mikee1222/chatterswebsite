export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getModelContext } from "@/lib/model-context-server";
import { ModelWeeklyAvailabilityClient } from "@/components/model-weekly-availability-client";
import { getThisWeekMonday, normalizeWeekStart, addDays } from "@/lib/weekly-program";
import { getPeriodDatesForWeek } from "@/services/model-periods";
import { modelWeeklyAvailabilityUrl } from "@/lib/routes";
import { getModelAvailabilityRequestsForWeek } from "@/services/weekly-availability-requests-models";

export default async function ModelAvailabilityPage({
  searchParams,
}: {
  searchParams: { week_start?: string };
}) {
  let linkedModelId: Awaited<ReturnType<typeof getModelContext>>["linkedModelId"] = null;
  let modelRecord: Awaited<ReturnType<typeof getModelContext>>["modelRecord"] = null;
  let language: Awaited<ReturnType<typeof getModelContext>>["language"] = "en";
  try {
    ({ linkedModelId, modelRecord, language } = await getModelContext());
  } catch (error) {
    console.error("[model/availability] getModelContext failed; rendering fallback", error);
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-white">Weekly availability</h1>
        <p className="text-white/70">Unable to load account context right now. Please try again.</p>
      </div>
    );
  }

  if (!linkedModelId || !modelRecord) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-white">Weekly availability</h1>
        <p className="text-white/70">Your account must be linked to a model to submit availability.</p>
      </div>
    );
  }

  const rawWeek = searchParams.week_start?.trim();
  const weekStart = normalizeWeekStart(rawWeek || getThisWeekMonday());
  if (rawWeek && rawWeek !== weekStart) redirect(modelWeeklyAvailabilityUrl(weekStart));

  if (process.env.NODE_ENV === "development") {
    console.log("[model/availability] linkedModelId", linkedModelId);
  }

  const weekEnd = addDays(weekStart, 6);
  const [requests, periodDatesThisWeek] = await Promise.all([
    getModelAvailabilityRequestsForWeek(weekStart, linkedModelId).catch((error) => {
      console.error("[model/availability] getModelAvailabilityRequestsForWeek failed; using [] fallback", error);
      return [];
    }),
    getPeriodDatesForWeek(linkedModelId, weekStart, weekEnd).catch((error) => {
      console.error("[model/availability] getPeriodDatesForWeek failed; using [] fallback", error);
      return [] as string[];
    }),
  ]);
  const submittedThisWeek = requests.length > 0;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-white">Weekly availability</h1>
      <div className="mb-6 flex gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
        <span className="text-2xl">📅</span>
        <div>
          <p className="text-sm font-semibold text-white">What is this?</p>
          <p className="mt-1 text-sm text-white/60">
            Every week, tell us which days and times you are available to record content.
            Your VA will use this to schedule your scripts and photo sets.
            Please submit before Friday so we can plan next week&apos;s content.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
        ⏰ Submit by Friday to be included in next week&apos;s schedule
      </div>

      {submittedThisWeek ? (
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          ✅ Availability submitted for this week
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          ⚠️ You haven&apos;t submitted your availability yet this week
        </div>
      )}

      <ModelWeeklyAvailabilityClient
        modelId={linkedModelId}
        language={language}
        weekStart={weekStart}
        initialRequests={requests}
        periodDatesThisWeek={periodDatesThisWeek}
      />
    </div>
  );
}
