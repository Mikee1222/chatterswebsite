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

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-white">Weekly availability</h1>
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
